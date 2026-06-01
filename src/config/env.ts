// Validation and typing of environment variables
import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().refine(
      (val) => {
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid database URL" },
    ),
    JWT_SECRET: z.string().min(32, "Secret must be at least 32 characters"),
    PORT: z.string().default("3000"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    CORS_ORIGIN: z.string().default("*"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && data.CORS_ORIGIN === "*") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CORS_ORIGIN cannot be "*" in production',
        path: ["CORS_ORIGIN"],
      });
    }
  });

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Error in environment variables:", _env.error.issues);
  throw new Error("Invalid environment variables.");
}

export const env = _env.data;
