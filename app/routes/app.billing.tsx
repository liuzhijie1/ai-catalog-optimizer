import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { UpgradeButton } from "../components/UpgradeButton";
import {
  BILLING_PLAN_PRO,
  PRO_PLAN_FEATURES,
  PRO_PLAN_PRICE_USD,
  getBillingReturnUrl,
  isBillingTestMode,
} from "../constants/billing";
import { syncShopPlanFromBilling } from "../services/billing.server";
import { getUsageSummary } from "../services/usage.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  await syncShopPlanFromBilling(session.shop, billing);

  const usage = await getUsageSummary(session.shop);
  const billingCheck = await billing.check({ plans: [BILLING_PLAN_PRO] });
  const url = new URL(request.url);
  const justUpgraded = url.searchParams.get("upgraded") === "1";

  return {
    usage,
    hasActivePayment: billingCheck.hasActivePayment,
    isTest: isBillingTestMode(),
    justUpgraded,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "upgrade") {
    return billing.request({
      plan: BILLING_PLAN_PRO,
      isTest: isBillingTestMode(),
      returnUrl: getBillingReturnUrl("/app/billing?upgraded=1"),
    });
  }

  if (intent === "sync") {
    await syncShopPlanFromBilling(session.shop, billing);
    return { ok: true };
  }

  return { error: "Unknown action." };
};

export default function BillingPage() {
  const { usage, hasActivePayment, isTest, justUpgraded } =
    useLoaderData<typeof loader>();

  const isPro = usage.plan === "pro" || hasActivePayment;

  return (
    <s-page heading="Plan & Billing">
      {justUpgraded && isPro && (
        <s-banner tone="success">
          Welcome to Pro! You now have unlimited optimizations.
        </s-banner>
      )}

      {isTest && (
        <s-banner tone="info">
          Test billing mode — charges are simulated and cards are not billed.
        </s-banner>
      )}

      <s-section heading="Current plan">
        <s-stack direction="block" gap="base">
          <s-badge tone={isPro ? "success" : "neutral"}>
            {isPro ? "Pro" : "Free"}
          </s-badge>

          {isPro ? (
            <s-paragraph>
              You have unlimited AI optimizations and batch processing.
            </s-paragraph>
          ) : (
            <s-paragraph>
              {usage.used}/{usage.limit} optimizations used this month (
              {usage.remaining} remaining).
            </s-paragraph>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Plans">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "12px",
          }}
        >
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Free</s-heading>
              <s-text type="strong">$0 / month</s-text>
              <s-unordered-list>
                <s-list-item>10 optimizations per month</s-list-item>
                <s-list-item>Single & batch optimize</s-list-item>
                <s-list-item>Preview before apply</s-list-item>
              </s-unordered-list>
              {!isPro && <s-badge tone="success">Current plan</s-badge>}
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Pro</s-heading>
              <s-text type="strong">${PRO_PLAN_PRICE_USD} / month</s-text>
              <s-unordered-list>
                {PRO_PLAN_FEATURES.map((feature) => (
                  <s-list-item key={feature}>{feature}</s-list-item>
                ))}
              </s-unordered-list>
              {isPro ? (
                <s-badge tone="success">Current plan</s-badge>
              ) : (
                <UpgradeButton label="Upgrade to Pro" />
              )}
            </s-stack>
          </s-box>
        </div>
      </s-section>

      <s-section slot="aside" heading="Billing FAQ">
        <s-unordered-list>
          <s-list-item>
            Charges appear on your Shopify invoice, not a separate bill.
          </s-list-item>
          <s-list-item>
            You can cancel anytime from Shopify Admin → Settings → Apps.
          </s-list-item>
          <s-list-item>
            After upgrading, refresh this page if your plan does not update
            immediately.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
