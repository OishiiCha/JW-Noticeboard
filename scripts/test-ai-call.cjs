// Test the AI process endpoint
(async () => {
  const fileUrl = '/api/files/cmsvmsf6i001ev7n2hger4urr';
  const variant = 'midweek';

  console.log('Calling /api/ai-process with fileUrl:', fileUrl, 'variant:', variant);

  const res = await fetch('http://localhost:3003/api/ai-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileUrl, variant }),
  });

  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
})();
