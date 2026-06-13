import { HTTPException } from "hono/http-exception";
import prismaClient from "../../db/client";
import type {
  PrismaClient,
  OrderStatus,
  ClientType,
  PaymentStatus,
} from "../../../generated/prisma";
import {
  getPaginationParams,
  createPaginationMeta,
} from "../../utils/pagination";
import { ORDER_VALUE_MAX } from "../../config/constants";
import type { OrderPdfData } from "../../utils/pdf";
import type {
  CreateOrderInput,
  UpdateOrderInput,
  ChangeOrderStatusInput,
  OrderItemInput,
} from "./order-schema";

const ORDER_VALUE_MAX_CENTS = Math.round(ORDER_VALUE_MAX * 100);

function computeSubtotalCents(unitValue: string, quantity: number): number {
  return Math.round(parseFloat(unitValue) * 100) * quantity;
}

function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Per-field bounds keep each unit/quantity small, but the summed total can still
// exceed the Decimal(10,2) column. Guard here so it fails as a clean 400 rather
// than a Postgres numeric-overflow 500.
function assertTotalWithinCeiling(totalCents: number): void {
  if (totalCents > ORDER_VALUE_MAX_CENTS) {
    throw new HTTPException(400, {
      message: "O valor total da ordem excede o limite permitido",
    });
  }
}

function buildItemCreateData(item: OrderItemInput) {
  const subtotalCents = computeSubtotalCents(item.unitValue, item.quantity);
  return {
    description: item.description,
    category: item.category ?? null,
    unitValue: item.unitValue,
    quantity: item.quantity,
    subtotal: centsToDecimalString(subtotalCents),
  };
}

function computeTotalCents(items: OrderItemInput[]): number {
  return items.reduce(
    (acc, item) => acc + computeSubtotalCents(item.unitValue, item.quantity),
    0,
  );
}

// The free-text note only describes a PAID_OTHER payment, so it is cleared for
// every other status — keeping the column meaningful and not stale.
function resolvePaymentNote(
  status: PaymentStatus,
  note: string | null | undefined,
): string | null {
  return status === "PAID_OTHER" ? (note ?? null) : null;
}

// Maps the `?payment=paid|unpaid|all` filter to a Prisma where clause. "paid"
// means any non-UNPAID status.
function paymentFilterWhere(payment?: "paid" | "unpaid" | "all") {
  if (payment === "paid") return { paymentStatus: { not: "UNPAID" as const } };
  if (payment === "unpaid") return { paymentStatus: "UNPAID" as const };
  return {};
}

// Builds the payment fields for an update. The note is always coupled to the
// status: it is re-resolved against the new status (cleared unless PAID_OTHER),
// so an order can never carry a stale note for a non-PAID_OTHER status.
function buildPaymentUpdate(data: UpdateOrderInput): {
  paymentStatus?: PaymentStatus;
  paymentNote?: string | null;
} {
  if (data.paymentStatus === undefined) return {};
  return {
    paymentStatus: data.paymentStatus,
    paymentNote: resolvePaymentNote(data.paymentStatus, data.paymentNote),
  };
}

const ITEMS_SELECT = {
  id: true,
  description: true,
  category: true,
  unitValue: true,
  quantity: true,
  subtotal: true,
} as const;

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  description: true,
  value: true,
  status: true,
  paymentStatus: true,
  paymentNote: true,
  assignedUserId: true,
  clientId: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: ITEMS_SELECT,
    orderBy: { id: "asc" as const },
  },
} as const;

// List rows embed the client name so the orders table can display it without
// an extra round-trip per row.
const ORDER_LIST_SELECT = {
  ...ORDER_SELECT,
  client: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

const STATUS_HISTORY_SELECT = {
  id: true,
  fromStatus: true,
  toStatus: true,
  changedAt: true,
  note: true,
  changedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

const ORDER_DETAIL_SELECT = {
  ...ORDER_SELECT,
  client: {
    select: {
      id: true,
      name: true,
      document: true,
      clientType: true,
      partnerName: true,
    },
  },
  statusHistory: {
    select: STATUS_HISTORY_SELECT,
    orderBy: { changedAt: "asc" as const },
  },
} as const;

export class OrderService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  // Order numbers are sequential per company, so the company starts its own
  // OS-0001 series. The @@unique([companyId, orderNumber]) constraint guards
  // integrity under concurrent creates.
  private async generateOrderNumber(companyId: number): Promise<string> {
    const last = await this.prisma.serviceOrder.findFirst({
      where: { companyId },
      orderBy: { id: "desc" },
      select: { orderNumber: true },
    });

    if (!last) return "OS-0001";

    const num = parseInt(last.orderNumber.replace("OS-", ""), 10);
    return `OS-${String(num + 1).padStart(4, "0")}`;
  }

  async clientExists(id: number, companyId: number): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    return client !== null;
  }

  // An order can only be assigned to an active member of its company, so this
  // checks membership rather than mere user existence — preventing assignment
  // to users outside the tenant.
  async userExists(id: number, companyId: number): Promise<boolean> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId: id, companyId, status: "ACTIVE" },
      select: { id: true },
    });
    return membership !== null;
  }

  async create(data: CreateOrderInput, createdById: number, companyId: number) {
    const totalCents = computeTotalCents(data.items);
    assertTotalWithinCeiling(totalCents);

    const orderNumber = await this.generateOrderNumber(companyId);
    const totalValue = centsToDecimalString(totalCents);
    const paymentStatus = data.paymentStatus ?? "UNPAID";

    return await this.prisma.serviceOrder.create({
      data: {
        orderNumber,
        description: data.description,
        value: totalValue,
        paymentStatus,
        paymentNote: resolvePaymentNote(paymentStatus, data.paymentNote),
        clientId: data.clientId,
        companyId,
        assignedUserId: data.assignedUserId ?? null,
        items: {
          create: data.items.map(buildItemCreateData),
        },
        statusHistory: {
          create: {
            toStatus: "PENDING",
            changedById: createdById,
          },
        },
      },
      select: ORDER_SELECT,
    });
  }

  async getAll(
    companyId: number,
    page?: string | number,
    limit?: string | number,
    status?: OrderStatus,
    clientType?: ClientType,
    search?: string,
    payment?: "paid" | "unpaid" | "all",
    partnerName?: string,
  ) {
    const params = getPaginationParams(page, limit);

    // clientType and partnerName both scope the related client; merge them into
    // a single nested `client` filter so they compose instead of overwriting.
    const clientFilter = {
      ...(clientType ? { clientType } : {}),
      ...(partnerName
        ? {
            partnerName: {
              contains: partnerName,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const where = {
      companyId,
      ...(status ? { status } : {}),
      ...(Object.keys(clientFilter).length > 0 ? { client: clientFilter } : {}),
      ...paymentFilterWhere(payment),
      ...(search
        ? {
            OR: [
              {
                orderNumber: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                client: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { id: "desc" },
        select: ORDER_LIST_SELECT,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    const pagination = createPaginationMeta(params.page, params.limit, total);

    return { orders, pagination };
  }

  async findById(id: number, companyId: number) {
    return await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      select: ORDER_DETAIL_SELECT,
    });
  }

  async updateStatus(
    id: number,
    data: ChangeOrderStatusInput,
    changedById: number,
    companyId: number,
  ) {
    const current = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      select: { status: true },
    });

    if (!current) return null;

    await this.prisma.$transaction([
      this.prisma.statusHistory.create({
        data: {
          orderId: id,
          fromStatus: current.status,
          toStatus: data.status,
          changedById,
          note: data.note ?? null,
        },
      }),
      this.prisma.serviceOrder.update({
        where: { id },
        data: { status: data.status },
      }),
    ]);

    return await this.prisma.serviceOrder.findUnique({
      where: { id },
      select: ORDER_DETAIL_SELECT,
    });
  }

  async update(id: number, companyId: number, data: UpdateOrderInput) {
    const owned = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!owned) return null;

    const paymentUpdate = buildPaymentUpdate(data);

    if (data.items !== undefined) {
      const totalCents = computeTotalCents(data.items);
      assertTotalWithinCeiling(totalCents);
      const totalValue = centsToDecimalString(totalCents);
      const newItems = data.items;

      return await this.prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        return await tx.serviceOrder.update({
          where: { id },
          data: {
            ...(data.description !== undefined
              ? { description: data.description }
              : {}),
            value: totalValue,
            ...paymentUpdate,
            ...("assignedUserId" in data
              ? { assignedUserId: data.assignedUserId }
              : {}),
            items: {
              create: newItems.map(buildItemCreateData),
            },
          },
          select: ORDER_SELECT,
        });
      });
    }

    return await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...paymentUpdate,
        ...("assignedUserId" in data
          ? { assignedUserId: data.assignedUserId }
          : {}),
      },
      select: ORDER_SELECT,
    });
  }

  // Assembles the fully-resolved data the PDF renderer needs, scoped by company.
  // The company is pulled through the order's relation in the same query (one
  // round-trip). completedAt is the timestamp of the most recent COMPLETED
  // transition (not updatedAt), matching how billing reads completion
  // elsewhere. Returns null when the order is missing, so callers map it to 404.
  async getPdfData(
    id: number,
    companyId: number,
  ): Promise<OrderPdfData | null> {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      select: {
        orderNumber: true,
        description: true,
        value: true,
        status: true,
        paymentStatus: true,
        paymentNote: true,
        createdAt: true,
        items: {
          select: {
            description: true,
            category: true,
            unitValue: true,
            quantity: true,
            subtotal: true,
          },
          orderBy: { id: "asc" },
        },
        client: {
          select: { name: true, document: true, clientType: true },
        },
        company: {
          select: {
            name: true,
            document: true,
            phone: true,
            email: true,
            address: true,
            logoUrl: true,
            footerNote: true,
          },
        },
        statusHistory: {
          where: { toStatus: "COMPLETED" },
          orderBy: { changedAt: "desc" },
          take: 1,
          select: { changedAt: true },
        },
      },
    });
    if (!order) return null;

    return {
      orderNumber: order.orderNumber,
      description: order.description,
      value: order.value.toString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentNote: order.paymentNote,
      createdAt: order.createdAt,
      completedAt: order.statusHistory[0]?.changedAt ?? null,
      items: order.items.map((item) => ({
        description: item.description,
        category: item.category,
        unitValue: item.unitValue.toString(),
        quantity: item.quantity,
        subtotal: item.subtotal.toString(),
      })),
      client: order.client,
      company: order.company,
    };
  }

  async delete(id: number, companyId: number) {
    const owned = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!owned) return null;

    return await this.prisma.serviceOrder.delete({
      where: { id },
    });
  }
}
