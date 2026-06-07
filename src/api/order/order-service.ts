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
} from "./order-schema";

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

  private async generateOrderNumber(): Promise<string> {
    const last = await this.prisma.serviceOrder.findFirst({
      orderBy: { id: "desc" },
      select: { orderNumber: true },
    });

    if (!last) return "OS-0001";

    const num = parseInt(last.orderNumber.replace("OS-", ""), 10);
    return `OS-${String(num + 1).padStart(4, "0")}`;
  }

  async clientExists(id: number): Promise<boolean> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });
    return client !== null;
  }

  async userExists(id: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    return user !== null;
  }

  async create(data: CreateOrderInput, createdById: number) {
    const orderNumber = await this.generateOrderNumber();

    return await this.prisma.serviceOrder.create({
      data: {
        orderNumber,
        description: data.description,
        value: data.value,
        clientId: data.clientId,
        assignedUserId: data.assignedUserId ?? null,
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
    page?: string | number,
    limit?: string | number,
    status?: OrderStatus,
    clientType?: ClientType,
    search?: string,
  ) {
    const params = getPaginationParams(page, limit);

    const where = {
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
        select: ORDER_SELECT,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    const pagination = createPaginationMeta(params.page, params.limit, total);

    return { orders, pagination };
  }

  async findById(id: number) {
    return await this.prisma.serviceOrder.findUnique({
      where: { id },
      select: ORDER_DETAIL_SELECT,
    });
  }

  async updateStatus(
    id: number,
    data: ChangeOrderStatusInput,
    changedById: number,
  ) {
    const current = await this.prisma.serviceOrder.findUnique({
      where: { id },
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

  async update(id: number, data: UpdateOrderInput) {
    return await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.value !== undefined ? { value: data.value } : {}),
        ...("assignedUserId" in data
          ? { assignedUserId: data.assignedUserId }
          : {}),
      },
      select: ORDER_SELECT,
    });
  }

  async delete(id: number) {
    return await this.prisma.serviceOrder.delete({
      where: { id },
    });
  }
}
