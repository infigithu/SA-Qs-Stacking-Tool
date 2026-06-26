export async function onRequestPost({ env }) {
  try {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return json({
        ok: false,
        error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in Cloudflare env",
      }, 500);
    }

    const form = new FormData();
    form.append("chat_id", env.TELEGRAM_CHAT_ID);
    form.append("text", "✅ Solve Arena Cloudflare Telegram test successful.");

    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        body: form,
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return json({
        ok: false,
        error: text,
      }, 500);
    }

    return json({
      ok: true,
      telegram_response: text,
    });
  } catch (err) {
    return json({
      ok: false,
      error: err.message,
    }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
