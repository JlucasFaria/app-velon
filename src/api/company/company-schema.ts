import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";

export const companyResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Despachante Silva" }),
    document: z.string().nullable().openapi({ example: "12.345.678/0001-90" }),
    phone: z.string().nullable().openapi({ example: "(11) 3333-4444" }),
    email: z.string().nullable().openapi({ example: "contato@silva.com" }),
    address: z
      .string()
      .nullable()
      .openapi({ example: "Av. Central, 1000 - Centro" }),
    logoUrl: z
      .string()
      .nullable()
      .openapi({ example: "/uploads/logos/company-1.png" }),
    footerNote: z
      .string()
      .nullable()
      .openapi({ example: "Garantia de 90 dias para todos os serviços." }),
    createdAt: z.string().datetime().openapi({ description: "Creation date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ description: "Last update date" }),
  })
  .openapi("Company");

export const updateCompanySchema = z
  .object({
    name: z.string().min(2).optional().openapi({
      description: "Company name (shown on the service order PDF header)",
      example: "Despachante Silva",
    }),
    // Nullable so the client can clear an optional field (send null) — distinct
    // from omitting it (leave unchanged).
    document: z.string().min(11).max(18).nullable().optional().openapi({
      description: "CNPJ or the responsible person's CPF",
      example: "12.345.678/0001-90",
    }),
    phone: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "(11) 3333-4444" }),
    email: z
      .email()
      .nullable()
      .optional()
      .openapi({ example: "contato@silva.com" }),
    address: z.string().nullable().optional().openapi({
      example: "Av. Central, 1000 - Centro",
    }),
    footerNote: z.string().nullable().optional().openapi({
      description: "Optional note printed at the bottom of the PDF",
      example: "Garantia de 90 dias para todos os serviços.",
    }),
  })
  .openapi("UpdateCompanyInput");

export const companyDetailResponseSchema = successResponseSchema(
  companyResponseSchema,
  "CompanyResponse",
);

export const createCompanySchema = z
  .object({
    name: z
      .string()
      .min(2, "Nome da empresa deve ter no mínimo 2 caracteres")
      .openapi({
        description: "Company name",
        example: "Despachante Silva",
      }),
    document: z.string().min(11).max(18).nullable().optional().openapi({
      description: "CNPJ or responsible person's CPF",
      example: "12.345.678/0001-90",
    }),
    phone: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "(11) 3333-4444" }),
    email: z
      .email()
      .nullable()
      .optional()
      .openapi({ example: "contato@silva.com" }),
    address: z.string().nullable().optional().openapi({
      example: "Av. Central, 1000 - Centro",
    }),
    footerNote: z.string().nullable().optional().openapi({
      description: "Optional note printed at the bottom of the PDF",
      example: "Garantia de 90 dias para todos os serviços.",
    }),
  })
  .openapi("CreateCompanyInput");

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
