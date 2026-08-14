const resp = await fetch("http://localhost:3003/api/notices?visitor=true");
const data = await resp.json();
for (const n of data) {
  const hasImg = n.thumbnailUrl || n.fileUrl;
  console.log(n.id, n.title?.substring(0, 40), hasImg ? "IMG" : "no-img", n.thumbnailUrl || n.fileUrl || "");
}
