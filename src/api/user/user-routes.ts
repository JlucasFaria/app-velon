// User routes: list (paginated, protected) and create (public registration)
import { UserService } from "./user-service";
import {
  createUserSchema,
  createUserResponseSchema,
  paginatedUsersResponseSchema,
} from "./user-schema";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { authMiddleware, type AuthVariables } from "../../middlewares/auth";
import { successResponse } from "../../utils/response";
import { paginationQuerySchema } from "../../schemas/pagination";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";

export function createUserRoutes(userService: UserService = new UserService()) {
  const userRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // ─── Route Definitions ──────────────────────────────────────────

  const listUsersRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Users"],
    security: [{ bearerAuth: [] }],
    request: {
      query: paginationQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: paginatedUsersResponseSchema },
        },
        description: "User list retrieved successfully",
      },
      401: {
        content: {
          "application/json": { schema: errorResponseSchema },
        },
        description: "Missing or invalid authentication token",
      },
    },
  });

  const createUserRoute = createRoute({
    method: "post",
    path: "/",
    tags: ["Users"],
    request: {
      body: {
        content: { "application/json": { schema: createUserSchema } },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: createUserResponseSchema },
        },
        description: "User created successfully",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
      },
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Email already in use",
      },
    },
  });

  // ─── Route Handlers ─────────────────────────────────────────────

  // Apply auth middleware only to GET requests (list users).
  // POST stays public because it's the registration endpoint.
  userRoutes.get("/*", authMiddleware);

  userRoutes.openapi(listUsersRoute, async (c) => {
    const page = c.req.query("page");
    const limit = c.req.query("limit");
    const result = await userService.getAll(page, limit);
    return successResponse(c, result, 200, "Users retrieved successfully");
  });

  userRoutes.openapi(createUserRoute, async (c) => {
    const body = c.req.valid("json");
    const newUser = await userService.create({
      email: body.email,
      name: body.name,
      password: body.password,
    });

    return successResponse(c, newUser, 201, "User created successfully");
  });

  return userRoutes;
}
