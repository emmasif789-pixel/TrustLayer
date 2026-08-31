import * as cheerio from "cheerio";

export interface ArticleContent {
  title: string;
  text: string;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_CHARS = 6000;

/**
 * Best-effort fetch + extraction. Returns null on any failure (blocked,
 * paywalled, timeout, non-HTML) — the caller falls back to inferring
 * claims from the URL/framing alone rather than failing the analysis.
 */
export async function fetchArticleContent(url: string): Promise<ArticleContent | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TrustLayerBot/1.0; +https://github.com/emmasif789-pixel/TrustLayer)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("text/html")) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    $("script, style, nav, header, footer, aside, noscript, iframe, svg, form").remove();

    const title = $("title").first().text().trim() || $("h1").first().text().trim();

    // Prefer <article> if the page has one; otherwise fall back to body text.
    const container = $("article").length > 0 ? $("article") : $("body");
    const text = container
      .find("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((p) => p.length > 40) // drop nav crumbs / captions / boilerplate lines
      .join("\n\n")
      .trim();

    if (!text || text.length < 200) return null; // likely paywalled or JS-rendered

    return { title, text: text.slice(0, MAX_CHARS) };
  } catch {
    return null;
  }
}
