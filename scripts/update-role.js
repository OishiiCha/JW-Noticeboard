const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  const result = await prisma.user.updateMany({
    where: { role: "admin" },
    data: { role: "super_admin" },
  });
  console.log("Updated", result.count, "users to super_admin");
  await prisma.$disconnect();
}

run().catch(console.error);
