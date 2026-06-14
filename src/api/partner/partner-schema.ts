import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";

export const partnerResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Parceiro XYZ" }),
    companyId: z.number().openapi({ example: 1 }),
    createdAt: z.string().datetime().openapi({ description: "Creation date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ description: "Last update date" }),
  })
  .openapi("Partner");

export const createPartnerSchema = z
  .object({
    name: z.string().min(2).openapi({
      description: "Partner name (unique per company)",
      example: "Parceiro XYZ",
    }),
  })
  .openapi("CreatePartnerInput");

export const partnerListResponseSchema = successResponseSchema(
  partnerResponseSchema.array(),
  "PartnerListResponse",
);

export const createPartnerResponseSchema = successResponseSchema(
  partnerResponseSchema,
  "CreatePartnerResponse",
);

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
