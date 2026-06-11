// Main application setup: middleware registration, routes, and OpenAPI config
import { env } from "./config/env";
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { structuredLogger } from "./utils/logger";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "hono/bun";
import { createUserRoutes } from "./api/user/user-routes";
import { createAuthRoutes } from "./api/auth/auth-routes";
import { createHealthRoutes } from "./api/health/health-routes";
import { createClientRoutes } from "./api/client/client-routes";
import { createOrderRoutes } from "./api/order/order-routes";
import { createReceiptRoutes } from "./api/receipt/receipt-routes";
import { createReportRoutes } from "./api/report/report-routes";
import { createCompanyRoutes } from "./api/company/company-routes";
import { UserService } from "./api/user/user-service";
import { errorHandler } from "./middlewares/error-handler";
import { requestIdMiddleware } from "./middlewares/request-id";
import {
  rateLimitMiddleware,
  rateLimitCleanupInterval,
} from "./middlewares/rate-limit";
import { tokenBlacklistCleanupInterval } from "./middlewares/auth";
import prisma from "./db/client";
import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  BODY_LIMIT_BYTES,
  LOGO_MAX_BYTES,
  LOGO_UPLOAD_PATH,
  UPLOADS_DIR,
  UPLOADS_URL_PREFIX,
} from "./config/constants";

const app = new OpenAPIHono();

// Register JWT Bearer auth scheme for OpenAPI/Swagger
app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

// Global middlewares (order matters!)
app.use("*", secureHeaders()); // Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
app.use("*", requestIdMiddleware); // Attach request ID
app.use("*", structuredLogger);
app.use(
  "*",
  cors({
    origin:
      env.CORS_ORIGIN === "*"
        ? "*"
        : env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);
app.use(
  "/api/*",
  rateLimitMiddleware(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS),
);
// Body limit: 1 MB by default, raised to 2 MB only for the company logo upload.
app.use("/api/*", (c, next) => {
  const maxSize =
    c.req.path === LOGO_UPLOAD_PATH ? LOGO_MAX_BYTES : BODY_LIMIT_BYTES;
  return bodyLimit({ maxSize })(c, next);
});

// Serve user-uploaded files (e.g. company logos) under /api/uploads/* so they
// resolve through the same origin/proxy as the API. Public by design — logos
// are embedded in <img> tags and printed on PDFs.
app.use(
  `${UPLOADS_URL_PREFIX}/*`,
  serveStatic({
    root: `./${UPLOADS_DIR}`,
    rewriteRequestPath: (path) =>
      path.replace(new RegExp(`^${UPLOADS_URL_PREFIX}`), ""),
  }),
);

// OpenAPI documentation
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Hono Prisma API",
  },
});

app.get("/ui", swaggerUI({ url: "/doc" }));

app.get("/", (c) => c.text("Server is running!"));

// Global error handler
app.onError(errorHandler);

app.route("/health", createHealthRoutes());
app.route("/api/users", createUserRoutes());
app.route("/api/auth", createAuthRoutes(new UserService()));
app.route("/api/clients", createClientRoutes());
app.route("/api/orders", createOrderRoutes());
app.route("/api/orders", createReceiptRoutes());
app.route("/api/reports", createReportRoutes());
app.route("/api/company", createCompanyRoutes());

const port = env.PORT;
console.log(`\n🚀 Server running at: http://localhost:${port}`);
console.log(`📚 Swagger UI:        http://localhost:${port}/ui`);
console.log(`📄 OpenAPI doc:       http://localhost:${port}/doc\n`);

// Graceful shutdown: disconnect Prisma on SIGINT (Ctrl+C) and SIGTERM (Docker/K8s)
const shutdown = async () => {
  clearInterval(rateLimitCleanupInterval);
  clearInterval(tokenBlacklistCleanupInterval);
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
