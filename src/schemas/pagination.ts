// Shared pagination schemas for OpenAPI documentation
import { z } from "@hono/zod-openapi";

export const paginationQuerySchema = z.object({
  page: z.string().optional().openapi({ example: "1" }),
  limit: z.string().optional().openapi({ example: "10" }),
});

export const paginationMetaSchema = z
  .object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  })
  .openapi("PaginationMeta");
