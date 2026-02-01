import Exa from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

/**
 * Search for music news using Exa.ai
 * Returns relevant articles with titles, URLs, and snippets
 */
export async function searchMusicNews(query) {
  try {
    const results = await exa.searchAndContents(query, {
      numResults: 10,
      useAutoprompt: true,
      includeDomains: [
        "pitchfork.com",
        "residentadvisor.net",
        "nytimes.com",
        "theguardian.com",
        "stereogum.com",
        "consequenceofsound.net",
        "nme.com",
        "rollingstone.com",
      ],
      text: { maxCharacters: 500 },
    });

    if (!results.results || results.results.length === 0) {
      return null;
    }

    return results.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.text?.slice(0, 300) || "",
      publishedDate: r.publishedDate || null,
    }));
  } catch (error) {
    console.error("Exa search error:", error.message);
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
