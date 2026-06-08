import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";

export class ReportService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async getMonthlyBilling(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Filter by the actual completion event (StatusHistory) rather than
    // updatedAt, which changes on any later edit. The order must still be
    // COMPLETED to exclude ones reverted/cancelled afterwards.
    const histories = await this.prisma.statusHistory.findMany({
      where: {
        toStatus: "COMPLETED",
        changedAt: { gte: startDate, lt: endDate },
        order: { status: "COMPLETED" },
      },
      select: {
        changedAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            description: true,
            value: true,
            client: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { changedAt: "asc" },
    });

    const totalCents = histories.reduce((sum, h) => {
      return sum + Math.round(parseFloat(h.order.value.toString()) * 100);
    }, 0);

    return {
      month,
      year,
      totalRevenue: (totalCents / 100).toFixed(2),
      orderCount: histories.length,
      orders: histories.map((h) => ({
        id: h.order.id,
        orderNumber: h.order.orderNumber,
        description: h.order.description,
        value: h.order.value.toString(),
        completedAt: h.changedAt.toISOString(),
        client: h.order.client,
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
