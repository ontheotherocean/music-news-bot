import "dotenv/config";
import { Bot, webhookCallback } from "grammy";
import { createServer } from "node:http";
import { chat, rankAndDigest, planQuery } from "./openai.js";
import { searchMusicNews, collectWeeklyNews, formatSearchContext } from "./exa.js";

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

// /start command
bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет! Я музыкальный эксперт-бот.\n\n" +
      "Спроси меня о музыкальных новостях, релизах, артистах — я найду актуальную информацию и отвечу со ссылками на источники.\n\n" +
      "Команды:\n" +
      "/news — сводка 10 главных музыкальных новостей за неделю\n\n" +
      "Или просто напиши вопрос:\n" +
      '• "Новые альбомы этой недели"\n' +
      '• "Что нового в электронной музыке?"\n' +
      '• "Что пишут про Филипа Гласса?"'
  );
});

// /news command — weekly digest with 2-step pipeline
bot.command("news", async (ctx) => {
  const thinkingMsg = await ctx.reply(
    "🔍 Собираю новости с Pitchfork, Resident Advisor, NYT, Guardian..."
  );

  try {
    // Step 1: Collect articles from all sources in parallel
    const allArticles = await collectWeeklyNews();

    if (!allArticles || allArticles.length === 0) {
      await safeEdit(
        ctx,
        thinkingMsg.message_id,
        "Не удалось найти свежие новости. Попробуйте позже."
      );
      return;
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      `🧠 Найдено ${allArticles.length} статей, выбираю 10 самых важных...`
    );

    // Step 2: GPT ranks and picks top 10
    const context = formatSearchContext(allArticles);
    const digest = await rankAndDigest(context);

    await safeEdit(ctx, thinkingMsg.message_id, digest);
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

  const thinkingMsg = await ctx.reply("🧠 Думаю...");

  try {
    // Step 1: GPT decides if search is needed + generates English queries
    const plan = await planQuery(userText);
    console.log("Query plan:", JSON.stringify(plan));

    let searchContext = null;
    let allowedUrls = [];

    if (plan.needsSearch && plan.searchQueries?.length > 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        thinkingMsg.message_id,
        "🔍 Ищу информацию..."
      );

      // Step 2: Run each search query through Exa, collect and dedupe
      const allArticles = [];
      const seenUrls = new Set();

      for (const query of plan.searchQueries) {
        const results = await searchMusicNews(query);
        if (results) {
          for (const r of results) {
            if (!seenUrls.has(r.url)) {
              seenUrls.add(r.url);
              allArticles.push(r);
            }
          }
        }
      }

      if (allArticles.length > 0) {
        searchContext = formatSearchContext(allArticles);
        allowedUrls = allArticles.map((a) => a.url);

        await ctx.api.editMessageText(
          ctx.chat.id,
          thinkingMsg.message_id,
          `🧠 Найдено ${allArticles.length} статей, формирую ответ...`
        );
      }
    }

    // Step 3: GPT answers with search context (or without)
    const response = await chat(userText, searchContext, allowedUrls);

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

// --- Webhook mode: no more 409 conflicts ---
const WEBHOOK_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhook`
  : process.env.WEBHOOK_URL;

const PORT = parseInt(process.env.PORT || "3000", 10);

if (WEBHOOK_URL) {
  // Production: use webhooks
  const handleUpdate = webhookCallback(bot, "http");

  const server = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/webhook") {
      try {
        await handleUpdate(req, res);
      } catch (err) {
        console.error("Webhook error:", err);
        res.writeHead(500);
        res.end("error");
      }
    } else {
      res.writeHead(200);
      res.end("ok");
    }
  });

  server.listen(PORT, async () => {
    // Set webhook with Telegram
    await bot.api.setWebhook(WEBHOOK_URL);
    console.log(`Bot webhook set: ${WEBHOOK_URL}`);
    console.log(`Server listening on port ${PORT}`);
  });
} else {
  // Local dev: use polling
  console.log("No WEBHOOK_URL — starting in polling mode");
  bot.start({
    drop_pending_updates: true,
    onStart: () => console.log("Bot is running (polling)!"),
  });
}
