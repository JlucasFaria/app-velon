import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";
import type { AllOrdersQuery } from "./report-schema";

const SERVICE_KEYWORDS = ["honorário", "serviço"];

function computeHonorarioCents(
  items: Array<{
    description: string;
    category: string | null;
    subtotal: { toString(): string };
  }>,
): number {
  return items
    .filter((i) => {
      const desc = i.description.trim().toLowerCase();
      const cat = i.category?.trim().toLowerCase() ?? "";
      return SERVICE_KEYWORDS.includes(desc) || SERVICE_KEYWORDS.includes(cat);
    })
    .reduce(
      (sum, i) => sum + Math.round(parseFloat(i.subtotal.toString()) * 100),
      0,
    );
}

export class ReportService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async getMonthlyBilling(companyId: number, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Filter by the actual completion event (StatusHistory) rather than
    // updatedAt, which changes on any later edit. The order must still be
    // COMPLETED to exclude ones reverted/cancelled afterwards, and belong to
    // the requesting company.
    const histories = await this.prisma.statusHistory.findMany({
      where: {
        toStatus: "COMPLETED",
        changedAt: { gte: startDate, lt: endDate },
        order: { status: "COMPLETED", companyId },
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
            items: {
              select: { description: true, category: true, subtotal: true },
            },
          },
        },
      },
      orderBy: { changedAt: "asc" },
    });

    let totalCents = 0;
    let totalHonorarioCents = 0;

    const orders = histories.map((h) => {
      const valueCents = Math.round(parseFloat(h.order.value.toString()) * 100);
      const honorarioCents = computeHonorarioCents(h.order.items);
      totalCents += valueCents;
      totalHonorarioCents += honorarioCents;

      return {
        id: h.order.id,
        orderNumber: h.order.orderNumber,
        description: h.order.description,
        // Always 2 decimals so the payload is consistent with totalRevenue.
        // Display formatting (R$ 100,00 / pt-BR) is handled on the frontend.
        value: (valueCents / 100).toFixed(2),
        honorario: (honorarioCents / 100).toFixed(2),
        completedAt: h.changedAt.toISOString(),
        client: h.order.client,
      };
    });

    return {
      month,
      year,
      totalRevenue: (totalCents / 100).toFixed(2),
      totalHonorario: (totalHonorarioCents / 100).toFixed(2),
      orderCount: histories.length,
      orders,
    };
  }

  async getOrdersSummary(companyId: number) {
    const groups = await this.prisma.serviceOrder.groupBy({
      by: ["status"],
      where: { companyId },
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

  async getAllOrders(companyId: number, filters: AllOrdersQuery) {
    const dateFrom = filters.dateFrom
      ? new Date(filters.dateFrom + "T00:00:00.000Z")
      : undefined;
    const dateTo = filters.dateTo
      ? new Date(filters.dateTo + "T23:59:59.999Z")
      : undefined;

    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        companyId,
        ...(filters.status && { status: filters.status }),
        ...(filters.partnerName && {
          client: {
            partner: {
              name: {
                contains: filters.partnerName,
                mode: "insensitive" as const,
              },
            },
          },
        }),
        ...((dateFrom ?? dateTo) && {
          createdAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }),
      },
      select: {
        id: true,
        orderNumber: true,
        value: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        items: {
          select: { description: true, category: true, subtotal: true },
        },
        statusHistory: {
          where: { toStatus: "COMPLETED" },
          orderBy: { changedAt: "desc" },
          take: 1,
          select: { changedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let sumTotalCents = 0;
    let sumHonorarioCents = 0;
    let totalReceivedCents = 0;

    const rows = orders.map((o) => {
      const totalCents = Math.round(parseFloat(o.value.toString()) * 100);
      const honorarioCents = computeHonorarioCents(o.items);

      sumTotalCents += totalCents;
      sumHonorarioCents += honorarioCents;
      if (o.paymentStatus !== "UNPAID") {
        totalReceivedCents += totalCents;
      }

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        client: o.client,
        createdAt: o.createdAt.toISOString(),
        completedAt: o.statusHistory[0]?.changedAt.toISOString() ?? null,
        total: (totalCents / 100).toFixed(2),
        honorario: (honorarioCents / 100).toFixed(2),
        paymentStatus: o.paymentStatus,
        status: o.status,
      };
    });

    return {
      orders: rows,
      totals: {
        sumTotal: (sumTotalCents / 100).toFixed(2),
        sumHonorario: (sumHonorarioCents / 100).toFixed(2),
        totalReceived: (totalReceivedCents / 100).toFixed(2),
      },
    };
  }
}
