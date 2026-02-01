import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Ты музыкальный эксперт высшего класса.
Пиши кратко и по существу. Отвечай на русском языке.

КРИТИЧЕСКИ ВАЖНО:
- Используй ТОЛЬКО информацию из предоставленных результатов поиска. НИКОГДА не придумывай новости, факты или события.
- Каждую новость сопровождай прямой ссылкой на источник в формате [название источника](url).
- Допустимые источники: Pitchfork, Resident Advisor, New York Times, The Guardian.
- Если результатов поиска нет — честно скажи, что не удалось найти актуальные новости, и предложи попробовать позже.
- НЕ ссылайся на главные страницы сайтов — только на конкретные статьи.`;

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

СТРОГО используй только предоставленные статьи. НЕ добавляй ничего от себя.`;

/**
 * Send a message to OpenAI and get a response (for general questions)
 */
export async function chat(userMessage, searchContext = null) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  let content = userMessage;
  if (searchContext) {
    content = `Вот результаты поиска по теме:\n\n${searchContext}\n\n---\nВопрос пользователя: ${userMessage}\n\nОтветь СТРОГО на основе этих результатов. Приведи ссылки на конкретные статьи.`;
  } else {
    content = `${userMessage}\n\n(Результаты поиска отсутствуют. Если вопрос требует актуальных данных — сообщи, что не удалось найти информацию.)`;
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
