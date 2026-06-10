// Seed script: populates the database with initial data for development/testing
import prisma from "../src/db/client";

const DEFAULT_COMPANY_NAME = "Minha Empresa";

const users = [
  { email: "admin@template.com", name: "Admin", password: "admin1234" },
  { email: "alice@template.com", name: "Alice", password: "alice1234" },
  { email: "bob@template.com", name: "Bob", password: "bob12345" },
];

async function main() {
  // Clear refresh tokens first to avoid FK constraint issues on upsert
  await prisma.refreshToken.deleteMany();

  // Ensure a single default company exists (idempotent: reuse the first one).
  const company =
    (await prisma.company.findFirst({ orderBy: { id: "asc" } })) ??
    (await prisma.company.create({ data: { name: DEFAULT_COMPANY_NAME } }));

  for (const user of users) {
    const hashed = await Bun.password.hash(user.password);
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, password: hashed },
      create: { email: user.email, name: user.name, password: hashed },
    });

    // Every seed user is an active ADMIN of the default company.
    await prisma.membership.upsert({
      where: {
        userId_companyId: { userId: created.id, companyId: company.id },
      },
      update: { role: "ADMIN", status: "ACTIVE" },
      create: {
        userId: created.id,
        companyId: company.id,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  }

  console.log("Seed completed successfully!");
  console.log(`\nDefault company: ${company.name} (id ${company.id})`);
  console.log("\nDefault credentials:");
  for (const user of users) {
    console.log(`  ${user.email} / ${user.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
