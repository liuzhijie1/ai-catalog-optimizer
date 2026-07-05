import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { UpgradeButton } from "../components/UpgradeButton";
import { syncShopPlanFromBilling } from "../services/billing.server";
import { getDashboardStats } from "../services/optimization-log.server";
import { getUsageSummary } from "../services/usage.server";
import { authenticate } from "../shopify.server";

const PRODUCTS_COUNT_QUERY = `#graphql
  query ProductsCount {
    productsCount {
      count
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  await syncShopPlanFromBilling(session.shop, billing);

  const [usage, stats, productsResponse] = await Promise.all([
    getUsageSummary(session.shop),
    getDashboardStats(session.shop),
    admin.graphql(PRODUCTS_COUNT_QUERY),
  ]);

  const productsJson = await productsResponse.json();
  const productCount = productsJson.data?.productsCount?.count ?? 0;

  return { usage, stats, productCount };
};

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="small">
        <s-text tone="neutral">{label}</s-text>
        <s-heading>{value}</s-heading>
        {detail && <s-text tone="neutral">{detail}</s-text>}
      </s-stack>
    </s-box>
  );
}

export default function Dashboard() {
  const { usage, stats, productCount } = useLoaderData<typeof loader>();

  const quotaLabel =
    usage.plan === "pro"
      ? "Unlimited"
      : `${usage.used}/${usage.limit}`;

  const avgImprovementLabel =
    stats.avgScoreImprovement !== null
      ? `+${stats.avgScoreImprovement} pts`
      : "—";

  return (
    <s-page heading="Dashboard">
      <s-link slot="primary-action" href="/app/products">
        Optimize products
      </s-link>

      {usage.plan === "free" && usage.isLimited && (
        <s-banner tone="warning">
          <s-stack direction="inline" gap="base">
            <s-text>
              Free plan limit reached ({usage.limit}/month). Upgrade to Pro for
              unlimited optimizations.
            </s-text>
            <UpgradeButton />
          </s-stack>
        </s-banner>
      )}

      <s-section heading="This month">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          <StatCard
            label="Products optimized"
            value={String(stats.appliedThisMonth)}
            detail="Applied to Shopify"
          />
          <StatCard
            label="Avg. score improvement"
            value={avgImprovementLabel}
            detail="AI readiness score"
          />
          <StatCard
            label="Catalog size"
            value={String(productCount)}
            detail="Products in your store"
          />
          <StatCard
            label="Quota used"
            value={quotaLabel}
            detail={
              usage.plan === "pro" ? "Pro plan" : `${usage.remaining} remaining`
            }
          />
        </div>
      </s-section>

      <s-section heading="Get started">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Improve product titles, descriptions, and tags so AI shopping
            assistants can find and recommend your catalog more easily.
          </s-paragraph>
          <s-button variant="primary" href="/app/products">
            Go to Products
          </s-button>
        </s-stack>
      </s-section>

      {stats.recent.length > 0 && (
        <s-section heading="Recent optimizations" padding="none">
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header listSlot="inline">Score</s-table-header>
              <s-table-header listSlot="labeled">When</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {stats.recent.map((log) => (
                <s-table-row key={log.id}>
                  <s-table-cell>{log.productTitle}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone="success">
                      {log.scoreBefore} → {log.scoreAfter}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {new Date(log.createdAt).toLocaleString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <s-section slot="aside" heading="How it works">
        <s-unordered-list>
          <s-list-item>Select products on the Products page</s-list-item>
          <s-list-item>Run AI optimization and review changes</s-list-item>
          <s-list-item>Apply updates back to Shopify</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Your plan">
        {usage.plan === "pro" ? (
          <s-paragraph>
            <s-text type="strong">Pro</s-text> — unlimited optimizations
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            <s-unordered-list>
              <s-list-item>
                Plan: <s-text type="strong">Free</s-text>
              </s-list-item>
              <s-list-item>
                {usage.remaining} optimizations left this month
              </s-list-item>
            </s-unordered-list>
            <UpgradeButton />
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
