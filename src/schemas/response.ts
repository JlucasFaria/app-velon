// Shared response schemas for OpenAPI documentation
import { z } from "@hono/zod-openapi";

export const successResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
  name: string,
) =>
  z
    .object({
      success: z
        .literal(true)
        .openapi({ description: "Indicates successful operation" }),
      data: dataSchema,
      message: z
        .string()
        .optional()
        .openapi({ description: "Optional message" }),
    })
    .openapi(name);

export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.string(),
  })
  .openapi("ErrorResponse");

export const validationErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.string(),
    details: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional()
      .openapi({ description: "Field-level validation errors" }),
  })
  .openapi("ValidationErrorResponse");
