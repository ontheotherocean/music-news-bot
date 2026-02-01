import Exa from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

function oneWeekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

// Index/category pages to filter out — no real article content
function isArticlePage(url) {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split("/").filter(Boolean);

    // Must have at least 2 path segments to be an article
    if (segments.length < 2) return false;

    // Known index patterns
    const indexPatterns = [
      /^\/news\/?$/,
      /^\/music\/?$/,
      /^\/genre\//,
      /^\/tags\//,
      /^\/features\/?$/,
      /^\/reviews\/?$/,
      /^\/music\/music\+/,
      /^\/music\/popandrock\/?$/,
    ];
    if (indexPatterns.some((p) => p.test(pathname))) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch recent music articles from all target sources.
 * Runs multiple Exa queries in parallel — different angles per source —
 * then deduplicates and returns all found articles.
 */
export async function collectWeeklyNews() {
  const startDate = oneWeekAgo();

  // Multiple queries to cover different angles of music news
  const queries = [
    {
      q: "new album announcement release 2026",
      domains: ["pitchfork.com", "theguardian.com"],
    },
    {
      q: "music tour concert festival announcement",
      domains: ["pitchfork.com", "theguardian.com"],
    },
    {
      q: "music artist news award grammy",
      domains: ["pitchfork.com", "theguardian.com", "nytimes.com"],
    },
    {
      q: "music review album of the week",
      domains: ["pitchfork.com", "theguardian.com"],
    },
    {
      q: "electronic music DJ club event",
      domains: ["residentadvisor.net"],
    },
    {
      q: "new music feature artist interview",
      domains: ["residentadvisor.net"],
    },
    {
      q: "pop rock hip hop music artist",
      domains: ["nytimes.com"],
    },
  ];

  const allResults = [];
  const seenUrls = new Set();

  // Run in batches of 4 to respect Exa rate limit (5 req/sec)
  const batchResults = [];
  for (let i = 0; i < queries.length; i += 4) {
    const batch = queries.slice(i, i + 4);
    const results = await Promise.all(
      batch.map(async ({ q, domains }) => {
        try {
          const res = await exa.searchAndContents(q, {
            numResults: 10,
            includeDomains: domains,
            startPublishedDate: startDate,
            text: { maxCharacters: 500 },
          });
          return res.results || [];
        } catch (err) {
          console.error(`Exa query error [${q}]:`, err.message);
          return [];
        }
      })
    );
    batchResults.push(...results);
    if (i + 4 < queries.length) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  for (const batch of batchResults) {
    for (const r of batch) {
      if (!seenUrls.has(r.url) && isArticlePage(r.url)) {
        seenUrls.add(r.url);
        allResults.push({
          title: r.title,
          url: r.url,
          snippet: r.text?.slice(0, 400) || "",
          publishedDate: r.publishedDate || null,
        });
      }
    }
  }

  console.log(`Exa: collected ${allResults.length} unique articles from ${queries.length} queries`);
  return allResults.length > 0 ? allResults : null;
}

/**
 * Simpler single-query search for free-form user questions
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
      ],
      startPublishedDate: oneWeekAgo(),
      text: { maxCharacters: 500 },
    });

    if (!results.results || results.results.length === 0) {
      console.log("Exa: no results for query:", query);
      return null;
    }

    const articles = results.results.filter((r) => isArticlePage(r.url));
    console.log(`Exa: ${results.results.length} results, ${articles.length} after filtering`);

    return articles.length > 0
      ? articles.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.text?.slice(0, 300) || "",
          publishedDate: r.publishedDate || null,
        }))
      : null;
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
