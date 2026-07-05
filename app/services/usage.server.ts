import prisma from "../db.server";

export const FREE_MONTHLY_LIMIT = Number(process.env.FREE_MONTHLY_LIMIT ?? 10);

export type ShopPlan = "free" | "pro";

export type UsageSummary = {
  plan: ShopPlan;
  used: number;
  limit: number | null;
  remaining: number | null;
  isLimited: boolean;
  monthKey: string;
};

function getMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function getShopPlan(shop: string): Promise<ShopPlan> {
  const record = await prisma.shopPlan.findUnique({ where: { shop } });
  return record?.plan === "pro" ? "pro" : "free";
}

export async function getUsageSummary(shop: string): Promise<UsageSummary> {
  const plan = await getShopPlan(shop);
  const monthKey = getMonthKey();

  if (plan === "pro") {
    return {
      plan,
      used: 0,
      limit: null,
      remaining: null,
      isLimited: false,
      monthKey,
    };
  }

  const usage = await prisma.optimizationUsage.findUnique({
    where: { shop_monthKey: { shop, monthKey } },
  });

  const used = usage?.count ?? 0;
  const limit = FREE_MONTHLY_LIMIT;
  const remaining = Math.max(0, limit - used);

  return {
    plan,
    used,
    limit,
    remaining,
    isLimited: used >= limit,
    monthKey,
  };
}

export function getUsageLimitMessage(summary: UsageSummary): string {
  return `Free plan limit reached (${summary.limit}/month). Upgrade to Pro for unlimited optimizations.`;
}

export async function assertCanOptimize(shop: string): Promise<UsageSummary> {
  const summary = await getUsageSummary(shop);

  if (summary.isLimited) {
    throw new Error(getUsageLimitMessage(summary));
  }

  return summary;
}

export async function recordOptimization(shop: string): Promise<UsageSummary> {
  const plan = await getShopPlan(shop);
  const monthKey = getMonthKey();

  if (plan === "pro") {
    return getUsageSummary(shop);
  }

  await prisma.optimizationUsage.upsert({
    where: { shop_monthKey: { shop, monthKey } },
    create: { shop, monthKey, count: 1 },
    update: { count: { increment: 1 } },
  });

  return getUsageSummary(shop);
}
