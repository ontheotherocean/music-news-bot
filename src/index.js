import "dotenv/config";
import { Bot } from "grammy";
import { chat } from "./openai.js";
import { searchMusicNews, formatSearchContext } from "./exa.js";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Helper: edit message with Markdown, fallback to plain text if Telegram rejects it
async function safeEdit(ctx, messageId, text) {
  try {
    await ctx.api.editMessageText(ctx.chat.id, messageId, text, {
      parse_mode: "Markdown",
    });
  } catch {
    // Markdown failed — send as plain text
    await ctx.api.editMessageText(ctx.chat.id, messageId, text);
  }
}

// Keywords that trigger a web search before answering
const SEARCH_TRIGGERS = [
  "новости",
  "news",
  "что нового",
  "что произошло",
  "последние",
  "свежие",
  "на этой неделе",
  "за неделю",
  "релиз",
  "release",
  "альбом",
  "album",
  "концерт",
  "фестиваль",
  "тур",
  "tour",
  "festival",
  "pitchfork",
  "guardian",
  "resident advisor",
];

function needsSearch(text) {
  const lower = text.toLowerCase();
  return SEARCH_TRIGGERS.some((trigger) => lower.includes(trigger));
}

// /start command
bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет! Я музыкальный эксперт-бот.\n\n" +
      "Спроси меня о музыкальных новостях, релизах, артистах — я найду актуальную информацию и отвечу со ссылками на источники.\n\n" +
      "Команды:\n" +
      "/news — сводка 10 главных музыкальных новостей за неделю\n\n" +
      "Или просто напиши вопрос:\n" +
      '• "Новые альбомы этой недели"\n' +
      '• "Что нового в электронной музыке?"'
  );
});

// /news command — weekly digest shortcut
bot.command("news", async (ctx) => {
  const thinkingMsg = await ctx.reply("🔍 Ищу последние музыкальные новости...");

  try {
    const searchResults = await searchMusicNews(
      "important music news this week releases albums tours festivals"
    );
    const searchContext = formatSearchContext(searchResults);

    await ctx.api.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      "🧠 Анализирую найденное..."
    );

    const response = await chat(
      "Расскажи о 10 самых важных музыкальных новостях за последнюю неделю.",
      searchContext
    );

    await safeEdit(ctx, thinkingMsg.message_id, response);
  } catch (error) {
    console.error("Error in /news:", error?.message || error);
    await safeEdit(
      ctx,
      thinkingMsg.message_id,
      "Произошла ошибка при получении новостей. Попробуйте позже."
    );
  }
});

// Handle all text messages
bot.on("message:text", async (ctx) => {
  const userText = ctx.message.text;
  const shouldSearch = needsSearch(userText);

  // Show "thinking" message
  const thinkingMsg = await ctx.reply(
    shouldSearch ? "🔍 Ищу информацию..." : "🧠 Думаю..."
  );

  try {
    let searchContext = null;

    if (shouldSearch) {
      const searchResults = await searchMusicNews(userText);
      searchContext = formatSearchContext(searchResults);

      if (searchContext) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          thinkingMsg.message_id,
          "🧠 Анализирую найденное..."
        );
      }
    }

    const response = await chat(userText, searchContext);

    await safeEdit(ctx, thinkingMsg.message_id, response);
  } catch (error) {
    console.error("Error handling message:", error?.message || error);

    try {
      await safeEdit(
        ctx,
        thinkingMsg.message_id,
        "Произошла ошибка при обработке запроса. Попробуйте ещё раз."
      );
    } catch {
      // Message edit failed too, ignore
    }
  }
});

// Error handler
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

// Drop pending updates on start to avoid conflicts
bot.start({
  drop_pending_updates: true,
  onStart: () => console.log("Bot is running!"),
});
