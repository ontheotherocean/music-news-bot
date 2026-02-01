import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Ты музыкальный эксперт высшего класса.
Пиши кратко и по существу. Отвечай на русском языке.

АБСОЛЮТНОЕ ПРАВИЛО: ты можешь ссылаться ТОЛЬКО на URL, которые явно перечислены в результатах поиска ниже.
НИКОГДА не придумывай и не генерируй URL самостоятельно. Если URL не указан в результатах поиска — не используй его.
Если результатов поиска нет или их недостаточно — отвечай на основе своих знаний, но БЕЗ ССЫЛОК.
Не пиши "Sources:" и не приводи список URL, если они не из результатов поиска.`;

const RANKING_PROMPT = `Ты музыкальный редактор. Тебе дан список статей, собранных за последнюю неделю с ведущих музыкальных изданий (Pitchfork, Resident Advisor, New York Times, The Guardian).

Твоя задача — выбрать 10 самых важных и интересных новостей для музыкального дайджеста.

Критерии оценки важности (от самого важного к менее):
1. Крупные релизы альбомов известных артистов
2. Награды и номинации (Grammy, Brit Awards и т.д.)
3. Значимые анонсы туров и фестивалей
4. Смерть, уход или возвращение значимых артистов
5. Индустриальные новости с широким влиянием
6. Интересные коллаборации и неожиданные проекты
7. Новые артисты, получившие значительное признание

Отвечай на русском. Для каждой новости:
- Напиши краткое описание (1-2 предложения)
- Обязательно укажи прямую ссылку на статью-источник в формате [источник](url)
- Укажи дату публикации если она есть

СТРОГО используй только предоставленные статьи. НЕ добавляй ничего от себя. НЕ придумывай URL.`;

const QUERY_PLANNER_PROMPT = `Ты помощник, который анализирует вопрос пользователя о музыке и решает, нужен ли поиск свежих статей.

Ответь строго в JSON формате (без markdown):
{
  "needsSearch": true/false,
  "searchQueries": ["query1 in English", "query2 in English"],
  "reasoning": "brief explanation"
}

Правила:
- needsSearch=true если вопрос про: новости, свежие релизы, туры, события, что происходит с артистом сейчас, текущие проекты
- needsSearch=false если вопрос про: общие знания, история музыки, теория, мнение, рекомендации из прошлого
- searchQueries: 1-3 коротких запроса НА АНГЛИЙСКОМ, оптимизированных для поиска по музыкальным изданиям
- Если вопрос на русском про артиста — транслитерируй имя на английский (Филип Гласс → Philip Glass)
- Каждый запрос — это 3-6 слов, конкретный и точный`;

/**
 * GPT decides if search is needed and generates optimal English search queries
 */
export async function planQuery(userMessage) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: QUERY_PLANNER_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 300,
    temperature: 0,
  });

  try {
    const raw = completion.choices[0].message.content.trim();
    return JSON.parse(raw);
  } catch {
    // Fallback: search with the original text
    return { needsSearch: true, searchQueries: [userMessage], reasoning: "parse error" };
  }
}

/**
 * Send a message to OpenAI and get a response (for general questions)
 * allowedUrls: list of URLs from search results that GPT is allowed to reference
 */
export async function chat(userMessage, searchContext = null, allowedUrls = []) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  let content = userMessage;
  if (searchContext) {
    const urlList = allowedUrls.map((u) => `- ${u}`).join("\n");
    content =
      `Вот результаты поиска по теме:\n\n${searchContext}\n\n` +
      `РАЗРЕШЁННЫЕ URL (только эти можно использовать в ответе):\n${urlList}\n\n` +
      `---\nВопрос пользователя: ${userMessage}\n\nОтветь на основе результатов поиска. Используй ТОЛЬКО URL из списка выше.`;
  } else {
    content = `${userMessage}\n\n(Результатов поиска нет. Отвечай на основе своих знаний, но БЕЗ КАКИХ-ЛИБО ССЫЛОК. Не пиши "Sources:" и не придумывай URL.)`;
  }

  messages.push({ role: "user", content });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 2048,
    temperature: 0.3,
  });

  return completion.choices[0].message.content;
}

/**
 * Rank and digest: GPT selects top 10 most important news from a large pool
 */
export async function rankAndDigest(articlesContext) {
  const messages = [
    { role: "system", content: RANKING_PROMPT },
    {
      role: "user",
      content: `Вот все собранные статьи за последнюю неделю:\n\n${articlesContext}\n\n---\nВыбери 10 самых важных новостей и составь краткий дайджест. Пронумеруй их от 1 до 10.`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 3000,
    temperature: 0.2,
  });

  return completion.choices[0].message.content;
}
