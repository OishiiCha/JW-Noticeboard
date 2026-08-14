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

    // Resolve the image URL to an absolute URL
    const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 2424}`;
    const absoluteImageUrl = imageUrl.startsWith("http") ? imageUrl : `${baseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;

    // Fetch the image and convert to base64
    const imgRes = await fetch(absoluteImageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
    }
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBase64 = Buffer.from(imgBuffer).toString("base64");
    const mimeType = imgRes.headers.get("content-type") || "image/png";

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
