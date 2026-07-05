export const BILLING_PLAN_PRO = "PRO" as const;

export const PRO_PLAN_PRICE_USD = 29;

export const PRO_PLAN_FEATURES = [
  "Unlimited AI optimizations",
  "Batch optimize & auto-apply",
  "Priority-ready catalog for AI channels",
] as const;

export function isBillingTestMode(): boolean {
  if (process.env.SHOPIFY_BILLING_TEST === "true") return true;
  if (process.env.SHOPIFY_BILLING_TEST === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function getBillingReturnUrl(path = "/app/billing"): string {
  const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    throw new Error("SHOPIFY_APP_URL is not configured.");
  }
  return `${appUrl}${path}`;
}
