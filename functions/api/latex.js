export async function onRequestOptions() {
  return new Response(null, {
    headers: corsHeaders(),
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { expression } = await request.json();

    if (!expression || expression.length > 500) {
      return json({ error: "Expression is required and must be under 500 characters" }, 400);
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Convert mathematical expressions to LaTeX only. Return only the LaTeX, no explanation.",
          },
          {
            role: "user",
            content: expression,
          },
        ],
        temperature: 0,
      }),
    });

    const data = await aiResponse.json();
    const latex = data.choices?.[0]?.message?.content || "";

    return json({ latex });
  } catch (error) {
    return json({ error: "Something went wrong" }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
