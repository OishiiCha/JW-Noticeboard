// Test Gemini API directly with the uploaded image
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  // Get the Gemini API key
  const setting = await db.setting.findUnique({ where: { key: 'geminiApiKey' } });
  if (!setting) {
    console.log('No Gemini key found');
    return;
  }
  let apiKey;
  try { apiKey = JSON.parse(setting.value); } catch { apiKey = setting.value; }
  console.log('API key:', apiKey.slice(0, 12) + '...');

  // Get the image from DB
  const fileId = 'cmsvmsf6i001ev7n2hger4urr';
  const file = await db.uploadedFile.findUnique({
    where: { id: fileId },
    select: { data: true, mimeType: true },
  });
  if (!file) {
    console.log('File not found');
    return;
  }
  console.log('Image found, mimeType:', file.mimeType, 'size:', file.data.length, 'bytes');

  const imgBase64 = Buffer.from(file.data).toString('base64');

  const prompt = `You are analyzing a midweek meeting schedule image. The current year is 2026. Extract ALL meeting weeks shown in the image — there may be multiple weeks/dates.\n\nConvert each week into this exact JSON format:\n\n[\n  {\n    "Date": "{YYYY-MM-DD}",\n    "BibleReading": "{Name}",\n    "TreasuresTalk": "{Name}",\n    "TreasuresGem": "{Name}",\n    "ApplyYourself1": "{Name}",\n    "ApplyYourself2": "{Name}",\n    "LivingTalk": "{Name}",\n    "CongregationBibleStudy": "{Name}",\n    "Reader": "{Name}",\n    "Prayer": "{Name}",\n    "Color": "{optional: the background or highlight color of this row/section in the image, as a hex code like #RRGGBB or a color name}"\n  }\n]\n\nIMPORTANT: Return an array with ONE object PER meeting date shown in the image. If the image shows 4 weeks, return 4 objects. Use the current year (2026) for dates unless the image clearly shows a different year. Return ONLY the JSON array, no other text.`;

  console.log('\nCalling Gemini API...');
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: file.mimeType || 'image/png', data: imgBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  console.log('Gemini status:', geminiRes.status);
  const resText = await geminiRes.text();
  if (!geminiRes.ok) {
    console.error('Gemini error:', resText);
    return;
  }

  const data = JSON.parse(resText);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('\nGemini result:');
  console.log(text);

  await db.$disconnect();
})();
