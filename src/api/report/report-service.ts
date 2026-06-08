import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";

export class ReportService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async getMonthlyBilling(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        status: "COMPLETED",
        updatedAt: { gte: startDate, lt: endDate },
      },
      select: {
        id: true,
        orderNumber: true,
        description: true,
        value: true,
        updatedAt: true,
        client: {
          select: { id: true, name: true },
        },
      },
      orderBy: { updatedAt: "asc" },
    });

    const totalCents = orders.reduce((sum, o) => {
      return sum + Math.round(parseFloat(o.value.toString()) * 100);
    }, 0);

    return {
      month,
      year,
      totalRevenue: (totalCents / 100).toFixed(2),
      orderCount: orders.length,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        description: o.description,
        value: o.value.toString(),
        completedAt: o.updatedAt.toISOString(),
        client: o.client,
      })),
    };
  }

  async getOrdersSummary() {
    const groups = await this.prisma.serviceOrder.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const summary = {
      PENDING: 0,
      IN_PROGRESS: 0,
      AWAITING_CLIENT: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const g of groups) {
      summary[g.status] = g._count.status;
    }

    return summary;
  }
}
