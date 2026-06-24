export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.OPENAI_API_KEY) {
      return json({ error: "Missing OPENAI_API_KEY" }, 500);
    }

    const body = await request.json();

    const systemPrompt = body.system_prompt || "";
    const userContent = body.user_content || "";

    if (!userContent.trim()) {
      return json({ error: "No content provided" }, 400);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        max_tokens: 1800,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return json({
        error: data.error?.message || "OpenAI request failed",
        details: data,
      }, response.status);
    }

    let fixedContent = data.choices?.[0]?.message?.content || "";

    fixedContent = fixedContent
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    return json({
      fixed_content: fixedContent,
    });
  } catch (error) {
    return json({
      error: error.message || "Validator fix failed",
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
