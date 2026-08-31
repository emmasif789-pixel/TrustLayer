export type DomainTier =
  | "wire-factcheck"
  | "gov-edu"
  | "major-outlet"
  | "aggregator"
  | "social-ugc"
  | "known-unreliable"
  | "unknown";

const TIER_BASELINE: Record<DomainTier, number> = {
  "wire-factcheck": 95,
  "gov-edu": 92,
  "major-outlet": 78,
  aggregator: 45,
  "social-ugc": 30,
  "known-unreliable": 8,
  unknown: 50,
};

const TIER_DESCRIPTION: Record<DomainTier, string> = {
  "wire-factcheck": "wire service or dedicated fact-checking organization",
  "gov-edu": "government or academic institution",
  "major-outlet": "established news outlet with editorial standards",
  aggregator: "aggregator/blog — may not do original reporting, verify upstream",
  "social-ugc": "social media / user-generated content — unverified by default",
  "known-unreliable": "has a documented history of publishing false or misleading claims",
  unknown: "no reputation data available — judge on content alone",
};

// Not exhaustive — a deliberately small, defensible curated set covering the
// domains that come up constantly, so the model has real grounding instead
// of guessing "credible" from vibes. Extend as gaps show up in real usage.
const WIRE_FACTCHECK = [
  "reuters.com",
  "apnews.com",
  "afp.com",
  "bbc.com",
  "bbc.co.uk",
  "npr.org",
  "factcheck.org",
  "snopes.com",
  "politifact.com",
  "fullfact.org",
  "apfactcheck.org",
];

const MAJOR_OUTLETS = [
  "nytimes.com",
  "washingtonpost.com",
  "theguardian.com",
  "wsj.com",
  "economist.com",
  "ft.com",
  "bloomberg.com",
  "cnn.com",
  "nbcnews.com",
  "cbsnews.com",
  "abcnews.go.com",
  "usatoday.com",
  "time.com",
  "newsweek.com",
  "scientificamerican.com",
  "nature.com",
  "sciencedirect.com",
  "thelancet.com",
  "nejm.org",
];

const AGGREGATORS = [
  "medium.com",
  "substack.com",
  "wordpress.com",
  "blogspot.com",
  "quora.com",
  "answers.com",
  "yahoo.com",
  "msn.com",
  "buzzfeed.com",
  "upworthy.com",
];

const SOCIAL_UGC = [
  "twitter.com",
  "x.com",
  "facebook.com",
  "reddit.com",
  "tiktok.com",
  "instagram.com",
  "youtube.com",
  "pinterest.com",
];

const KNOWN_UNRELIABLE = [
  "naturalnews.com",
  "infowars.com",
  "beforeitsnews.com",
  "yournewswire.com",
  "newspunch.com",
  "worldtruth.tv",
  "theonion.com", // satire — not "unreliable" maliciously, but not factual either
];

function matches(hostname: string, list: string[]): boolean {
  return list.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

export function classifyDomain(url: string): { tier: DomainTier; baseline: number; description: string } {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { tier: "unknown", baseline: TIER_BASELINE.unknown, description: TIER_DESCRIPTION.unknown };
  }

  let tier: DomainTier;
  if (hostname.endsWith(".gov") || hostname.endsWith(".edu") || hostname.endsWith(".mil") || matches(hostname, ["who.int", "cdc.gov", "nih.gov", "un.org"])) {
    tier = "gov-edu";
  } else if (matches(hostname, WIRE_FACTCHECK)) {
    tier = "wire-factcheck";
  } else if (matches(hostname, KNOWN_UNRELIABLE)) {
    tier = "known-unreliable";
  } else if (matches(hostname, MAJOR_OUTLETS)) {
    tier = "major-outlet";
  } else if (matches(hostname, SOCIAL_UGC)) {
    tier = "social-ugc";
  } else if (matches(hostname, AGGREGATORS)) {
    tier = "aggregator";
  } else {
    tier = "unknown";
  }

  return { tier, baseline: TIER_BASELINE[tier], description: TIER_DESCRIPTION[tier] };
}
