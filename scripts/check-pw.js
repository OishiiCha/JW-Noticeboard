const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findFirst({ where: { username: "admin" } });
  console.log("Admin user:", { username: u.username, email: u.email, password: u.password });
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
