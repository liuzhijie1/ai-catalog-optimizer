import { useEffect, useMemo, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { DowngradeButton } from "../components/DowngradeButton";
import { UpgradeButton } from "../components/UpgradeButton";
import {
  BILLING_PLAN_PRO,
  BILLING_PLAN_PRO_PROMO,
  PRO_PLAN_FEATURES,
  PRO_PLAN_PRICE_USD,
  PRO_PROMO_PRICE_USD,
  formatPlanPriceUsd,
  getBillingReturnUrl,
  isBillingTestMode,
  isValidPromoCode,
  normalizePromoCode,
  resolveBillingPlanForPromoCode,
} from "../constants/billing";
import { downgradeToFreePlan, syncShopPlanFromBilling } from "../services/billing.server";
import { getUsageSummary } from "../services/usage.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  await syncShopPlanFromBilling(session.shop, billing);

  const usage = await getUsageSummary(session.shop);
  const billingCheck = await billing.check({
    plans: [BILLING_PLAN_PRO, BILLING_PLAN_PRO_PROMO],
  });
  const url = new URL(request.url);
  const justUpgraded =
    url.searchParams.get("upgraded") === "1" ||
    url.searchParams.has("charge_id");
  const justDowngraded = url.searchParams.get("downgraded") === "1";

  return {
    usage,
    hasActivePayment: billingCheck.hasActivePayment,
    appSubscriptions: billingCheck.appSubscriptions,
    isTest: isBillingTestMode(),
    justUpgraded,
    justDowngraded,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "upgrade") {
    const promoCode = formData.get("promoCode");
    const promoCodeValue = typeof promoCode === "string" ? promoCode : "";
    const plan = resolveBillingPlanForPromoCode(promoCodeValue);

    if (promoCodeValue.trim() && !isValidPromoCode(promoCodeValue)) {
      return { error: "Invalid promo code." };
    }

    return billing.request({
      plan,
      isTest: isBillingTestMode(),
      returnUrl: getBillingReturnUrl(request, "/app/billing?upgraded=1"),
    });
  }

  if (intent === "downgrade") {
    try {
      await downgradeToFreePlan(session.shop, billing);
      await syncShopPlanFromBilling(session.shop, billing);
      return { ok: true, downgraded: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to switch to Free plan.";
      return { error: message };
    }
  }

  if (intent === "sync") {
    await syncShopPlanFromBilling(session.shop, billing);
    return { ok: true };
  }

  return { error: "Unknown action." };
};

export default function BillingPage() {
  const { usage, hasActivePayment, isTest, justUpgraded, justDowngraded } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [promoCode, setPromoCode] = useState("");

  const normalizedPromoCode = useMemo(
    () => normalizePromoCode(promoCode),
    [promoCode],
  );
  const hasPromoInput = promoCode.trim().length > 0;
  const promoApplied = isValidPromoCode(promoCode);
  const proPriceUsd = promoApplied ? PRO_PROMO_PRICE_USD : PRO_PLAN_PRICE_USD;
  const proPriceLabel = `$${formatPlanPriceUsd(proPriceUsd)} / month`;
  const upgradeLabel = promoApplied
    ? `Upgrade to Pro — $${formatPlanPriceUsd(PRO_PROMO_PRICE_USD)}/mo`
    : "Upgrade to Pro";

  const isPro = usage.plan === "pro" || hasActivePayment;
  const actionError =
    fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;
  const didDowngrade =
    justDowngraded ||
    Boolean(
      fetcher.data && "downgraded" in fetcher.data && fetcher.data.downgraded,
    );

  useEffect(() => {
    if (
      fetcher.data &&
      "downgraded" in fetcher.data &&
      fetcher.data.downgraded
    ) {
      revalidator.revalidate();
    }
  }, [fetcher.data, revalidator]);

  return (
    <s-page heading="Plan & Billing">
      {justUpgraded && isPro && (
        <s-banner tone="success">
          Welcome to Pro! You now have unlimited optimizations.
        </s-banner>
      )}

      {didDowngrade && (
        <s-banner tone="success">
          You are now on the Free plan. Your Pro subscription has been cancelled.
        </s-banner>
      )}

      {actionError && <s-banner tone="critical">{actionError}</s-banner>}

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
              {!isPro ? (
                <s-badge tone="success">Current plan</s-badge>
              ) : (
                <DowngradeButton label="Switch to Free plan" />
              )}
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Pro</s-heading>
              {promoApplied ? (
                <s-stack direction="inline" gap="small">
                  <s-text type="strong">{proPriceLabel}</s-text>
                  <s-text tone="neutral">
                    (was ${formatPlanPriceUsd(PRO_PLAN_PRICE_USD)} / month)
                  </s-text>
                </s-stack>
              ) : (
                <s-text type="strong">{proPriceLabel}</s-text>
              )}
              <s-unordered-list>
                {PRO_PLAN_FEATURES.map((feature) => (
                  <s-list-item key={feature}>{feature}</s-list-item>
                ))}
              </s-unordered-list>
              {!isPro && (
                <s-text-field
                  label="Promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.currentTarget.value)}
                  autocomplete="off"
                  details="Enter a promo code before upgrading"
                  error={
                    hasPromoInput && !promoApplied
                      ? "Invalid promo code."
                      : undefined
                  }
                />
              )}
              {promoApplied && (
                <s-banner tone="success">
                  Promo code {normalizedPromoCode} applied — Pro is $
                  {formatPlanPriceUsd(PRO_PROMO_PRICE_USD)}/month.
                </s-banner>
              )}
              {isPro ? (
                <s-badge tone="success">Current plan</s-badge>
              ) : (
                <UpgradeButton
                  label={upgradeLabel}
                  promoCode={promoApplied ? normalizedPromoCode : undefined}
                />
              )}
            </s-stack>
          </s-box>
        </div>
      </s-section>

      <s-section slot="aside" heading="Billing FAQ">
        <s-unordered-list>
          <s-list-item>
            Upgrade or downgrade anytime on this page — no need to reinstall
            the app or contact support.
          </s-list-item>
          <s-list-item>
            Charges appear on your Shopify invoice and in Settings → Apps →
            App charges.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
