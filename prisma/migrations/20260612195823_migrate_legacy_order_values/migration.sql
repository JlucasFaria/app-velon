-- Convert each legacy ServiceOrder (no items yet) into one OrderItem "Serviço"
-- preserving the original value. WHERE NOT EXISTS makes this idempotent.
INSERT INTO "OrderItem" ("orderId", "description", "category", "unitValue", "quantity", "subtotal", "createdAt", "updatedAt")
SELECT
  o."id",
  'Serviço',
  NULL,
  o."value",
  1,
  o."value",
  NOW(),
  NOW()
FROM "ServiceOrder" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."id"
);
