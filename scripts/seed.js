// Seed script for development — creates admin user and default categories
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function seed() {
  const existing = await prisma.user.findFirst({ where: { role: { in: ["admin", "super_admin"] } } });
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@jw.org";
  if (existing) {
    console.log("Admin already exists: " + existing.username);
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        name: "Admin",
        username: "admin",
        email: adminEmail,
        password: hashedPassword,
        role: "super_admin",
        isActive: true,
      },
    });
    console.log("Admin user created with email: " + adminEmail);
  }

  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    const defaults = [
      { name: "Announcements", nameTl: "Mga Anunsyo", slug: "announcements", icon: "megaphone", color: "bg-blue-500", sortOrder: 0 },
      { name: "Meetings", nameTl: "Mga Pulong", slug: "meetings", icon: "calendar", color: "bg-green-500", sortOrder: 1 },
      { name: "Events", nameTl: "Mga Kaganapan", slug: "events", icon: "calendar-days", color: "bg-purple-500", sortOrder: 2 },
      { name: "Ministry", nameTl: "Ministeryo", slug: "ministry", icon: "book-open", color: "bg-amber-500", sortOrder: 3 },
      { name: "Documents", nameTl: "Mga Dokumento", slug: "documents", icon: "file-text", color: "bg-gray-500", sortOrder: 4 },
    ];
    for (const cat of defaults) {
      await prisma.category.create({ data: cat });
    }
    console.log("Default categories created");
  } else {
    console.log("Categories already exist: " + categoryCount);
  }

  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
