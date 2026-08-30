export interface TavilyResult {
  url: string;
  title: string;
  content: string;
  published_date?: string;
  score: number;
}

export async function tavilySearch(
  query: string,
  opts: { maxResults?: number } = {}
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set");
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: opts.maxResults ?? 6,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return (data.results ?? []) as TavilyResult[];
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
