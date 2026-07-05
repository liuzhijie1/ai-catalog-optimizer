import prisma from "../db.server";

export type OptimizationLogInput = {
  shop: string;
  productId: string;
  productTitle: string;
  scoreBefore: number;
  scoreAfter: number;
};

export type DashboardStats = {
  appliedThisMonth: number;
  avgScoreImprovement: number | null;
  recent: Array<{
    id: string;
    productTitle: string;
    scoreBefore: number;
    scoreAfter: number;
    createdAt: string;
  }>;
};

function getMonthStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function logOptimizationApplied(
  input: OptimizationLogInput,
): Promise<void> {
  await prisma.optimizationLog.create({
    data: input,
  });
}

export async function getDashboardStats(shop: string): Promise<DashboardStats> {
  const monthStart = getMonthStart();

  const logs = await prisma.optimizationLog.findMany({
    where: {
      shop,
      createdAt: { gte: monthStart },
    },
    orderBy: { createdAt: "desc" },
  });

  const avgScoreImprovement =
    logs.length > 0
      ? Math.round(
          logs.reduce((sum, log) => sum + (log.scoreAfter - log.scoreBefore), 0) /
            logs.length,
        )
      : null;

  return {
    appliedThisMonth: logs.length,
    avgScoreImprovement,
    recent: logs.slice(0, 5).map((log) => ({
      id: log.id,
      productTitle: log.productTitle,
      scoreBefore: log.scoreBefore,
      scoreAfter: log.scoreAfter,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}
