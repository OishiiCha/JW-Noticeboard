import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NoticeboardBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const domain = getDomain(url);
      return NextResponse.json({ domain, favicon: `https://icons.duckduckgo.com/ip3/${domain}.ico` });
    }

    const html = await res.text();
    const preview = parseOpenGraph(html, url);
    return NextResponse.json(preview);
  } catch {
    const domain = getDomain(url);
    return NextResponse.json({ domain, favicon: `https://icons.duckduckgo.com/ip3/${domain}.ico` });
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function parseOpenGraph(html: string, url: string): {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  domain?: string;
} {
  const getMeta = (property: string): string | undefined => {
    const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, "i");
    const match = html.match(regex);
    return match?.[1];
  };

  const getLinkRel = (rel: string): string | undefined => {
    const regex = new RegExp(`<link[^>]*rel=["']${rel}["'][^>]*href=["']([^"']*)["']`, "i");
    const match = html.match(regex);
    return match?.[1];
  };

  const title = getMeta("og:title") || getMeta("twitter:title") || html.match(/<title>([^<]*)<\/title>/i)?.[1];
  const description = getMeta("og:description") || getMeta("twitter:description") || getMeta("description");
  let image = getMeta("og:image") || getMeta("twitter:image");
  const domain = getDomain(url);

  // Make image URL absolute
  if (image && !image.startsWith("http")) {
    try {
      image = new URL(image, url).href;
    } catch {
      image = undefined;
    }
  }

  // Try to get a high-quality favicon from the page's own HTML
  let favicon: string | undefined;
  const faviconCandidates = [
    getLinkRel("apple-touch-icon"),
    getLinkRel("apple-touch-icon-precomposed"),
    getLinkRel("icon"),
    getLinkRel("shortcut icon"),
    getMeta("og:image"),
  ];
  for (const candidate of faviconCandidates) {
    if (candidate) {
      try {
        favicon = candidate.startsWith("http") ? candidate : new URL(candidate, url).href;
        break;
      } catch {
        // skip invalid
      }
    }
  }

  // Fallback: DuckDuckGo (higher res) then Google (128px)
  if (!favicon) {
    favicon = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  }

  return { title, description, image, favicon, domain };
}
