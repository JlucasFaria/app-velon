import prismaClient from "../../db/client";
import type {
  PrismaClient,
  OrderStatus,
  ClientType,
} from "../../../generated/prisma";
import {
  getPaginationParams,
  createPaginationMeta,
} from "../../utils/pagination";
import type {
  CreateOrderInput,
  UpdateOrderInput,
  ChangeOrderStatusInput,
  OrderItemInput,
} from "./order-schema";

function computeSubtotalCents(unitValue: string, quantity: number): number {
  return Math.round(parseFloat(unitValue) * 100) * quantity;
}

function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
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
    const orderNumber = await this.generateOrderNumber(companyId);
    const totalValue = centsToDecimalString(computeTotalCents(data.items));

    return await this.prisma.serviceOrder.create({
      data: {
        orderNumber,
        description: data.description,
        value: totalValue,
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
  ) {
    const params = getPaginationParams(page, limit);

    const where = {
      companyId,
      ...(status ? { status } : {}),
      ...(clientType ? { client: { clientType } } : {}),
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

    if (data.items !== undefined) {
      const totalValue = centsToDecimalString(computeTotalCents(data.items));
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
        ...("assignedUserId" in data
          ? { assignedUserId: data.assignedUserId }
          : {}),
      },
      select: ORDER_SELECT,
    });
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
