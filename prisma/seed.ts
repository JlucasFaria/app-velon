// Seed script: populates the database with initial data for development/testing
import prisma from "../src/db/client";

const users = [
  { email: "admin@template.com", name: "Admin", password: "admin1234" },
  { email: "alice@template.com", name: "Alice", password: "alice1234" },
  { email: "bob@template.com", name: "Bob", password: "bob12345" },
];

async function main() {
  // Clear refresh tokens first to avoid FK constraint issues on upsert
  await prisma.refreshToken.deleteMany();

  for (const user of users) {
    const hashed = await Bun.password.hash(user.password);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, password: hashed },
      create: { email: user.email, name: user.name, password: hashed },
    });
  }

  console.log("Seed completed successfully!");
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
