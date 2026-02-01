import Exa from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

// Only the sources specified by the user
const ALLOWED_DOMAINS = [
  "pitchfork.com",
  "residentadvisor.net",
  "nytimes.com",
  "theguardian.com",
];

function oneWeekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

/**
 * Search for music news using Exa.ai
 * Restricted to Pitchfork, Resident Advisor, NYT, Guardian
 * Only returns articles from the last 7 days
 */
export async function searchMusicNews(query) {
  try {
    const results = await exa.searchAndContents(query, {
      numResults: 15,
      useAutoprompt: true,
      includeDomains: ALLOWED_DOMAINS,
      startPublishedDate: oneWeekAgo(),
      text: { maxCharacters: 500 },
    });

    if (!results.results || results.results.length === 0) {
      console.log("Exa: no results found for query:", query);
      return null;
    }

    // Filter out index/category pages — keep only actual articles
    const articles = results.results.filter((r) => {
      const path = new URL(r.url).pathname;
      // Skip if path is just /news/, /tags/..., /reviews/ etc. with no article slug
      const segments = path.split("/").filter(Boolean);
      return segments.length >= 2;
    });

    console.log(`Exa: found ${results.results.length} results, ${articles.length} after filtering`);

    return articles.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.text?.slice(0, 300) || "",
      publishedDate: r.publishedDate || null,
    }));
  } catch (error) {
    console.error("Exa search error:", error.message, error.response?.data || "");
    return null;
  }
}

/**
 * Format search results into a string context for the AI prompt
 */
export function formatSearchContext(results) {
  if (!results || results.length === 0) return "";

  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\n${r.snippet}\nИсточник: ${r.url}${r.publishedDate ? ` (${new Date(r.publishedDate).toLocaleDateString("ru-RU")})` : ""}`
    )
    .join("\n\n");
}
