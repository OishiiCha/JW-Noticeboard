import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-api";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { imageUrl, prompt } = body;

    if (!imageUrl || !prompt) {
      return NextResponse.json({ error: "Image URL and prompt are required" }, { status: 400 });
    }

    // Get the Gemini API key from settings
    const setting = await db.setting.findUnique({ where: { key: "geminiApiKey" } });
    if (!setting) {
      return NextResponse.json({ error: "AI processing is not configured" }, { status: 400 });
    }

    let apiKey: string;
    try {
      apiKey = JSON.parse(setting.value);
    } catch {
      apiKey = setting.value;
    }

    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json({ error: "AI processing is not configured" }, { status: 400 });
    }

    // Resolve the image — fetch directly from DB if it's a /api/files/ URL,
    // otherwise fetch via HTTP (absolute URLs directly; relative paths from
    // this server's own origin, so it works in dev and production)
    let imgBuffer: Buffer | undefined;
    let mimeType: string | undefined;

    // Normalize the image URL — extract the path portion if it's a full URL
    const normalizedUrl = imageUrl.startsWith("http") ? new URL(imageUrl).pathname : imageUrl;

    if (normalizedUrl.startsWith("/api/files/")) {
      // Extract file ID and fetch directly from database (no HTTP roundtrip needed)
      const fileId = normalizedUrl.replace("/api/files/", "").split("/")[0].split("?")[0];
      const file = await db.uploadedFile.findUnique({
        where: { id: fileId },
        select: { data: true, mimeType: true },
      });
      if (file?.data) {
        imgBuffer = Buffer.from(file.data);
        mimeType = file.mimeType || "image/png";
      } else {
        console.warn("[ai-process] File not in DB by ID, falling back to HTTP fetch:", fileId);
      }
    }

    if (!imgBuffer || !mimeType) {
      const absoluteImageUrl = imageUrl.startsWith("http")
        ? imageUrl
        : `${request.nextUrl.origin}${normalizedUrl.startsWith("/") ? "" : "/"}${normalizedUrl}`;
      const imgRes = await fetch(absoluteImageUrl);
      if (!imgRes.ok) {
        return NextResponse.json({ error: `Failed to fetch image (${imgRes.status})` }, { status: 500 });
      }
      const arrayBuffer = await imgRes.arrayBuffer();
      imgBuffer = Buffer.from(arrayBuffer);
      mimeType = imgRes.headers.get("content-type") || "image/png";
    }

    const imgBase64 = imgBuffer.toString("base64");

    // Call Gemini API (gemini-3.5-flash — current model, replaces deprecated gemini-2.0-flash).
    // Retries transient errors (429 rate limit, 500/503 overload) with backoff.
    const geminiBody = JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imgBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    let geminiRes: Response | null = null;
    let lastErrText = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: geminiBody }
      );
      if (geminiRes.ok) break;
      lastErrText = await geminiRes.text();
      // Only retry transient failures — auth/config errors fail fast
      if (![429, 500, 503].includes(geminiRes.status)) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }

    if (geminiRes && !geminiRes.ok) {
      console.error("Gemini API error:", lastErrText);
      let geminiMsg = `AI processing failed (${geminiRes.status})`;
      try {
        const parsed = JSON.parse(lastErrText);
        if (parsed?.error?.message) geminiMsg = parsed.error.message;
      } catch {}
      return NextResponse.json({ error: geminiMsg }, { status: geminiRes.status });
    }
    if (!geminiRes) {
      return NextResponse.json({ error: "AI processing failed — no response" }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json({ error: "AI returned no content" }, { status: 500 });
    }

    return NextResponse.json({ result: text });
  } catch (error) {
    console.error("Error in AI processing:", error);
    return NextResponse.json({ error: "Failed to process image with AI" }, { status: 500 });
  }
}
