import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";

const RECEIPT_SELECT = {
  id: true,
  receiptNumber: true,
  issuedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      description: true,
      value: true,
      items: {
        select: {
          id: true,
          description: true,
          category: true,
          unitValue: true,
          quantity: true,
          subtotal: true,
        },
        orderBy: { id: "asc" as const },
      },
      client: {
        select: {
          id: true,
          name: true,
          document: true,
        },
      },
    },
  },
} as const;

export class ReceiptService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async orderExists(id: number, companyId: number): Promise<boolean> {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    return order !== null;
  }

  async generate(orderId: number) {
    const existing = await this.prisma.receipt.findUnique({
      where: { orderId },
      select: RECEIPT_SELECT,
    });

    if (existing) return existing;

    return await this.prisma.receipt.create({
      data: { orderId },
      select: RECEIPT_SELECT,
    });
  }

  // Scoped by the order's company so a receipt can't be read across tenants.
  async getByOrderId(orderId: number, companyId: number) {
    return await this.prisma.receipt.findFirst({
      where: { orderId, order: { companyId } },
      select: RECEIPT_SELECT,
    });
  }
}
