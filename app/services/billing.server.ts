import {
  BILLING_PLAN_PRO,
  BILLING_PLAN_PRO_PROMO,
  isBillingTestMode,
  type ProBillingPlan,
} from "../constants/billing";
import prisma from "../db.server";
import type { ShopPlan } from "./usage.server";

type BillingCheck = {
  check: (options?: {
    plans?: ProBillingPlan[];
  }) => Promise<{
    hasActivePayment: boolean;
    appSubscriptions: Array<{ id: string }>;
  }>;
  cancel: (options: {
    subscriptionId: string;
    isTest?: boolean;
    prorate?: boolean;
  }) => Promise<unknown>;
};

export async function downgradeToFreePlan(
  shop: string,
  billing: BillingCheck,
): Promise<void> {
  const billingCheck = await billing.check({
    plans: [BILLING_PLAN_PRO, BILLING_PLAN_PRO_PROMO],
  });

  if (!billingCheck.hasActivePayment) {
    await setShopPlan(shop, "free");
    return;
  }

  const subscriptionId = billingCheck.appSubscriptions[0]?.id;

  if (!subscriptionId) {
    throw new Error("Active Pro subscription not found.");
  }

  await billing.cancel({
    subscriptionId,
    isTest: isBillingTestMode(),
    prorate: true,
  });

  await setShopPlan(shop, "free");
}

export async function syncShopPlanFromBilling(
  shop: string,
  billing: BillingCheck,
): Promise<ShopPlan> {
  const { hasActivePayment } = await billing.check({
    plans: [BILLING_PLAN_PRO, BILLING_PLAN_PRO_PROMO],
  });

  const plan: ShopPlan = hasActivePayment ? "pro" : "free";

  await prisma.shopPlan.upsert({
    where: { shop },
    create: { shop, plan },
    update: { plan },
  });

  return plan;
}

export async function setShopPlan(shop: string, plan: ShopPlan): Promise<void> {
  await prisma.shopPlan.upsert({
    where: { shop },
    create: { shop, plan },
    update: { plan },
  });
}
