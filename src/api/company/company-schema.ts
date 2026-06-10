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
    document: z.string().min(11).max(18).optional().openapi({
      description: "CNPJ or the responsible person's CPF",
      example: "12.345.678/0001-90",
    }),
    phone: z.string().optional().openapi({ example: "(11) 3333-4444" }),
    email: z.email().optional().openapi({ example: "contato@silva.com" }),
    address: z.string().optional().openapi({
      example: "Av. Central, 1000 - Centro",
    }),
    footerNote: z.string().optional().openapi({
      description: "Optional note printed at the bottom of the PDF",
      example: "Garantia de 90 dias para todos os serviços.",
    }),
  })
  .openapi("UpdateCompanyInput");

export const companyDetailResponseSchema = successResponseSchema(
  companyResponseSchema,
  "CompanyResponse",
);

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
