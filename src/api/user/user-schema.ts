// Zod schemas for user validation and OpenAPI documentation
import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";
import { paginationMetaSchema } from "../../schemas/pagination";

export const UserSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    email: z.email().openapi({ example: "dev@test.com" }),
    name: z.string().nullable().openapi({ example: "John Doe" }),
    createdAt: z.string().datetime().openapi({ description: "Creation date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ description: "Last update date" }),
  })
  .openapi("User");

export const createUserSchema = z
  .object({
    email: z.email().openapi({
      description: "New user email",
      example: "new@example.com",
    }),
    name: z.string().min(2).optional().openapi({
      description: "User name (optional)",
      example: "John Doe",
    }),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .openapi({
        description:
          "User password (min 8 chars, must include uppercase, lowercase, and a number)",
        example: "Secret123",
      }),
  })
  .openapi("CreateUserInput");

// User creation response schema
export const createUserResponseSchema = successResponseSchema(
  UserSchema,
  "CreateUserResponse",
);

// Paginated user list response schema
export const paginatedUsersResponseSchema = successResponseSchema(
  z.object({
    users: UserSchema.array(),
    pagination: paginationMetaSchema,
  }),
  "PaginatedUsersResponse",
);

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateMeSchema = z
  .object({
    name: z.string().min(2).optional().openapi({
      description: "New display name",
      example: "João Silva",
    }),
    email: z.email().optional().openapi({
      description: "New email address",
      example: "joao@example.com",
    }),
    currentPassword: z.string().optional().openapi({
      description:
        "Current password (required when changing email or password)",
      example: "OldPass123",
    }),
    newPassword: z
      .string()
      .min(8)
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .optional()
      .openapi({
        description:
          "New password (min 8 chars, must include uppercase, lowercase, and a number)",
        example: "NewPass456",
      }),
  })
  .openapi("UpdateMeInput")
  .superRefine((data, ctx) => {
    if (
      (data.email !== undefined || data.newPassword !== undefined) &&
      !data.currentPassword
    ) {
      ctx.addIssue({
        code: "custom",
        message: "currentPassword is required when changing email or password",
        path: ["currentPassword"],
      });
    }
  });

export const updateMeResponseSchema = successResponseSchema(
  UserSchema,
  "UpdateMeResponse",
);

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
