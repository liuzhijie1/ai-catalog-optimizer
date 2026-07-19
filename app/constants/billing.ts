export const BILLING_PLAN_PRO = "PRO" as const;
export const BILLING_PLAN_PRO_PROMO = "PRO_PROMO" as const;

export const PRO_BILLING_PLANS = [
  BILLING_PLAN_PRO,
  BILLING_PLAN_PRO_PROMO,
] as const;

export type ProBillingPlan = (typeof PRO_BILLING_PLANS)[number];

export const PRO_PLAN_PRICE_USD = 29;
export const PRO_PROMO_PRICE_USD = 0.1;
export const PROMO_CODE_LIU5720 = "LIU5720";

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

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidPromoCode(code: string): boolean {
  return normalizePromoCode(code) === PROMO_CODE_LIU5720;
}

export function resolveBillingPlanForPromoCode(
  code: string | null | undefined,
): ProBillingPlan {
  if (code && isValidPromoCode(code)) {
    return BILLING_PLAN_PRO_PROMO;
  }
  return BILLING_PLAN_PRO;
}

export function formatPlanPriceUsd(price: number): string {
  return price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
}

function normalizeBillingPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildEmbeddedBillingReturnUrl(host: string, path: string): string | null {
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) return null;

  const adminHost = Buffer.from(host, "base64").toString("utf-8");
  const embeddedBase = `https://${adminHost}/apps/${apiKey}`;
  return `${embeddedBase}${normalizeBillingPath(path)}`;
}

export function getBillingReturnUrl(
  request: Request,
  path = "/app/billing",
): string {
  const requestUrl = new URL(request.url);
  const host = requestUrl.searchParams.get("host");

  if (host) {
    const embeddedReturnUrl = buildEmbeddedBillingReturnUrl(host, path);
    if (embeddedReturnUrl) {
      return embeddedReturnUrl;
    }
  }

  const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    throw new Error("SHOPIFY_APP_URL is not configured.");
  }

  return `${appUrl}${normalizeBillingPath(path)}`;
}
