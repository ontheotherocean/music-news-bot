import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Ты музыкальный эксперт высшего класса. Каждую неделю присылай информацию о 10 важных музыкальных новостях в мире, произошедших за прошедшую неделю, основываясь на таких источниках как Pitchfork, Resident Advisor, New York Times, Guardian.
Пиши кратко и по существу.

Когда тебе предоставлены результаты поиска — используй их как основу для ответа и ОБЯЗАТЕЛЬНО указывай ссылки на источники в формате [текст](url).
Отвечай на русском языке.`;

/**
 * Send a message to OpenAI and get a response
 * @param {string} userMessage - The user's message
 * @param {string|null} searchContext - Optional search context from Exa
 */
export async function chat(userMessage, searchContext = null) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  let content = userMessage;
  if (searchContext) {
    content = `Вот результаты поиска по теме:\n\n${searchContext}\n\n---\nВопрос пользователя: ${userMessage}\n\nИспользуй найденную информацию для ответа и приведи ссылки на источники.`;
  }

  messages.push({ role: "user", content });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 2048,
    temperature: 0.7,
  });

  return completion.choices[0].message.content;
}
