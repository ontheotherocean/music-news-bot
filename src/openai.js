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
- НЕ ссылайся на главные страницы сайтов (вроде pitchfork.com/news/) — только на конкретные статьи.`;

/**
 * Send a message to OpenAI and get a response
 * @param {string} userMessage - The user's message
 * @param {string|null} searchContext - Optional search context from Exa
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
