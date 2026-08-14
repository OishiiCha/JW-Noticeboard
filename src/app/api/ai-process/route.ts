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
    // otherwise fetch via HTTP
    let imgBuffer: Buffer;
    let mimeType: string;

    // Normalize the image URL — extract the path portion if it's a full URL
    const normalizedUrl = imageUrl.startsWith("http") ? new URL(imageUrl).pathname : imageUrl;

    if (normalizedUrl.startsWith("/api/files/")) {
      // Extract file ID and fetch directly from database (no HTTP roundtrip needed)
      const fileId = normalizedUrl.replace("/api/files/", "").split("/")[0].split("?")[0];
      console.log("[ai-process] Looking up file ID:", fileId, "from URL:", imageUrl);
      const file = await db.uploadedFile.findUnique({
        where: { id: fileId },
        select: { data: true, mimeType: true },
      });
      if (!file || !file.data) {
        console.error("[ai-process] File not found in DB. ID:", fileId);
        return NextResponse.json({ error: `Image file not found in database (id: ${fileId})` }, { status: 404 });
      }
      imgBuffer = Buffer.from(file.data);
      mimeType = file.mimeType || "image/png";
    } else {
      // External URL or disk path — fetch via HTTP
      const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 2424}`;
      const absoluteImageUrl = normalizedUrl.startsWith("http") ? normalizedUrl : `${baseUrl}${normalizedUrl.startsWith("/") ? "" : "/"}${normalizedUrl}`;
      const imgRes = await fetch(absoluteImageUrl);
      if (!imgRes.ok) {
        return NextResponse.json({ error: `Failed to fetch image (${imgRes.status})` }, { status: 500 });
      }
      const arrayBuffer = await imgRes.arrayBuffer();
      imgBuffer = Buffer.from(arrayBuffer);
      mimeType = imgRes.headers.get("content-type") || "image/png";
    }

    const imgBase64 = imgBuffer.toString("base64");

    // Call Gemini API (gemini-2.0-flash — free tier)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json(
        { error: `AI processing failed: ${geminiRes.status}` },
        { status: geminiRes.status }
      );
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
