import { z } from "@hono/zod-openapi";

export const pdfShareResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      url: z.string().openapi({
        description: "Public, signed URL to download the OS PDF",
        example: "http://localhost:3000/api/pdf/shared/eyJhbGciOi...",
      }),
      expiresAt: z.string().openapi({
        description: "ISO timestamp when the link stops working",
        example: "2026-06-20T12:00:00.000Z",
      }),
    }),
    message: z.string(),
  })
  .openapi("PdfShareResponse");
