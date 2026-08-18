const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  const notices = await db.notice.findMany({
    where: { OR: [{ title: { contains: 'idweek' } }, { title: { contains: 'chedule' } }] },
    select: { id: true, title: true, content: true, fileUrl: true, fileName: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('Recent schedule notices:');
  console.log(JSON.stringify(notices, null, 2));

  const settings = await db.setting.findMany({ where: { key: 'geminiApiKey' } });
  console.log('\nGemini key set:', settings.length > 0 ? 'yes (' + settings[0].value.slice(0, 10) + '...)' : 'no');

  await db.$disconnect();
})();
