// Single source of truth for all tuneable values used across the application

// Auth token lifetimes
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Database connection pool
export const DB_POOL_MAX = 10;
export const DB_POOL_IDLE_TIMEOUT_MS = 30_000; // 30 seconds
export const DB_POOL_CONNECT_TIMEOUT_MS = 5_000; // 5 seconds

// Rate limiting
export const RATE_LIMIT_MAX_REQUESTS = 100;
export const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

// Body size
export const BODY_LIMIT_BYTES = 1 * 1024 * 1024; // 1 MB

// Pagination
export const PAGINATION_DEFAULT_PAGE = 1;
export const PAGINATION_DEFAULT_LIMIT = 10;
export const PAGINATION_MAX_LIMIT = 100;
