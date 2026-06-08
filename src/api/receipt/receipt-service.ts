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

  async getByOrderId(orderId: number) {
    return await this.prisma.receipt.findUnique({
      where: { orderId },
      select: RECEIPT_SELECT,
    });
  }
}
