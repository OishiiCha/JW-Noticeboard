const { compare } = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findFirst({ where: { username: "admin" } });
  const match = await compare("admin2414", u.password);
  console.log("Password 'admin2414' matches:", match);
  if (!match) {
    const match2 = await compare("admin123", u.password);
    console.log("Password 'admin123' matches:", match2);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
