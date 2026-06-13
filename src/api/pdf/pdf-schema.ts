import { z } from "@hono/zod-openapi";

export const sendOrderEmailBodySchema = z
  .object({
    to: z.string().email().openapi({
      description: "Recipient email address",
      example: "cliente@exemplo.com",
    }),
    subject: z.string().min(1).max(200).optional().openapi({
      description: "Email subject (default generated from order number)",
      example: "Ordem de Serviço OS-0001",
    }),
    body: z.string().max(2000).optional().openapi({
      description: "Custom message to include above the PDF link",
      example: "Segue o link para acessar sua ordem de serviço.",
    }),
  })
  .openapi("SendOrderEmailBody");

export const sendOrderEmailResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      url: z.string().openapi({
        description: "Share link included in the email",
        example: "http://localhost:3000/api/pdf/shared/eyJhbGciOi...",
      }),
      expiresAt: z.string().openapi({
        description: "ISO timestamp when the link stops working",
        example: "2026-06-20T12:00:00.000Z",
      }),
    }),
    message: z.string(),
  })
  .openapi("SendOrderEmailResponse");

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
