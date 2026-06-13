import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";
import { ORDER_ITEM_QUANTITY_MAX } from "../../config/constants";

export const templateItemInputSchema = z
  .object({
    description: z.string().min(1, "Descrição obrigatória").openapi({
      example: "Troca de tela",
    }),
    category: z.string().optional().openapi({ example: "Honorário" }),
    suggestedValue: z
      .string()
      // Up to 8 integer digits keeps a suggested value within Decimal(10,2).
      .regex(/^\d{1,8}(\.\d{1,2})?$/, "Valor sugerido inválido")
      .openapi({
        description: "Suggested unit value as decimal string",
        example: "250.00",
      }),
    quantity: z
      .number()
      .int("Quantidade deve ser um número inteiro")
      .positive("Quantidade deve ser positiva")
      .max(ORDER_ITEM_QUANTITY_MAX, "Quantidade muito alta")
      .optional()
      .openapi({ example: 1 }),
  })
  .openapi("ServiceTemplateItemInput");

export const templateItemResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    description: z.string().openapi({ example: "Troca de tela" }),
    category: z.string().nullable().openapi({ example: "Honorário" }),
    suggestedValue: z.string().openapi({ example: "250.00" }),
    quantity: z.number().nullable().openapi({ example: 1 }),
  })
  .openapi("ServiceTemplateItem");

export const templateResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Formatação de computador" }),
    defaultDescription: z
      .string()
      .openapi({ example: "Formatação completa com backup dos dados" }),
    items: templateItemResponseSchema.array(),
    createdAt: z.string().datetime().openapi({ description: "Creation date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ description: "Last update date" }),
  })
  .openapi("ServiceTemplate");

export const createTemplateSchema = z
  .object({
    name: z.string().min(2).openapi({
      description: "Template name (unique per company)",
      example: "Formatação de computador",
    }),
    defaultDescription: z.string().min(1).openapi({
      description: "Description that pre-fills the order",
      example: "Formatação completa com backup dos dados",
    }),
    items: templateItemInputSchema
      .array()
      .default([])
      .openapi({ description: "Suggested line items" }),
  })
  .openapi("CreateServiceTemplateInput");

export const updateTemplateSchema = z
  .object({
    name: z.string().min(2).optional().openapi({
      description: "Template name (unique per company)",
      example: "Formatação de computador",
    }),
    defaultDescription: z.string().min(1).optional().openapi({
      description: "Description that pre-fills the order",
      example: "Formatação completa com backup dos dados",
    }),
    items: templateItemInputSchema
      .array()
      .optional()
      .openapi({ description: "Replace all suggested line items" }),
  })
  .openapi("UpdateServiceTemplateInput");

export const createTemplateResponseSchema = successResponseSchema(
  templateResponseSchema,
  "CreateServiceTemplateResponse",
);

export const templateDetailResponseSchema = successResponseSchema(
  templateResponseSchema,
  "ServiceTemplateDetailResponse",
);

export const templateListResponseSchema = successResponseSchema(
  templateResponseSchema.array(),
  "ServiceTemplateListResponse",
);

export const updateTemplateResponseSchema = successResponseSchema(
  templateResponseSchema,
  "UpdateServiceTemplateResponse",
);

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type TemplateItemInput = z.infer<typeof templateItemInputSchema>;
