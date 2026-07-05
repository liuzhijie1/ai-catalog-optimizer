import prisma from "../db.server";

export async function deleteShopData(shop: string): Promise<void> {
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { shop } }),
    prisma.shopPlan.deleteMany({ where: { shop } }),
    prisma.optimizationUsage.deleteMany({ where: { shop } }),
    prisma.optimizationLog.deleteMany({ where: { shop } }),
  ]);
}
