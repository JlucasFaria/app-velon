import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";
import { paginationMetaSchema } from "../../schemas/pagination";

const clientTypeSchema = z.enum(["COUNTER", "PARTNER"]).openapi({
  description: "Client type",
  example: "COUNTER",
});

const orderStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "AWAITING_CLIENT",
  "COMPLETED",
  "CANCELLED",
]);

const partnerSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Parceiro XYZ" }),
  })
  .nullable()
  .openapi({ description: "Partner reference" });

export const clientResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    registrationNumber: z.number().nullable().openapi({ example: 1 }),
    name: z.string().openapi({ example: "João Silva" }),
    document: z.string().openapi({ example: "123.456.789-00" }),
    phone: z.string().nullable().openapi({ example: "(11) 91234-5678" }),
    address: z.string().nullable().openapi({ example: "Rua das Flores, 123" }),
    clientType: clientTypeSchema,
    partner: partnerSchema,
    createdAt: z.string().datetime().openapi({ description: "Creation date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ description: "Last update date" }),
  })
  .openapi("Client");

const linkedOrderSchema = z.object({
  id: z.number(),
  orderNumber: z.string(),
  description: z.string(),
  value: z.string(),
  status: orderStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const clientDetailResponseSchema = clientResponseSchema
  .extend({
    orders: linkedOrderSchema.array(),
  })
  .openapi("ClientDetail");

const clientInputBaseSchema = z.object({
  name: z.string().min(2).openapi({
    description: "Client full name",
    example: "João Silva",
  }),
  document: z.string().min(11).max(18).openapi({
    description: "CPF or CNPJ (unique)",
    example: "123.456.789-00",
  }),
  phone: z.string().optional().openapi({
    description: "Contact phone number",
    example: "(11) 91234-5678",
  }),
  address: z.string().optional().openapi({
    description: "Client address",
    example: "Rua das Flores, 123",
  }),
  clientType: clientTypeSchema,
  partnerId: z.number().int().optional().openapi({
    description: "Partner ID (required when clientType is PARTNER)",
    example: 1,
  }),
});

export const createClientSchema = clientInputBaseSchema
  .refine((d) => d.clientType !== "PARTNER" || !!d.partnerId, {
    message: "ID do parceiro é obrigatório para clientes do tipo Parceiro",
    path: ["partnerId"],
  })
  .openapi("CreateClientInput");

export const updateClientSchema = clientInputBaseSchema
  .partial()
  .refine((d) => d.clientType !== "PARTNER" || !!d.partnerId, {
    message: "ID do parceiro é obrigatório para clientes do tipo Parceiro",
    path: ["partnerId"],
  })
  .openapi("UpdateClientInput");

export const clientSearchResultSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "João Silva" }),
    document: z.string().openapi({ example: "123.456.789-00" }),
    clientType: clientTypeSchema,
  })
  .openapi("ClientSearchResult");

export const clientSearchResponseSchema = successResponseSchema(
  clientSearchResultSchema.array(),
  "ClientSearchResponse",
);

export const partnerNameSuggestionsResponseSchema = successResponseSchema(
  z.string().array(),
  "PartnerNameSuggestionsResponse",
);

export const createClientResponseSchema = successResponseSchema(
  clientResponseSchema,
  "CreateClientResponse",
);

export const clientDetailWithOrdersResponseSchema = successResponseSchema(
  clientDetailResponseSchema,
  "ClientDetailResponse",
);

export const paginatedClientsResponseSchema = successResponseSchema(
  z.object({
    clients: clientResponseSchema.array(),
    pagination: paginationMetaSchema,
  }),
  "PaginatedClientsResponse",
);

export const updateClientResponseSchema = successResponseSchema(
  clientResponseSchema,
  "UpdateClientResponse",
);

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientSearchResult = z.infer<typeof clientSearchResultSchema>;
