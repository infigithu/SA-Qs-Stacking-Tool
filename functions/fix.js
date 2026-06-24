const QUESTION_SCHEMA = {
  title: { type: "string" },
  subject: { type: "string" },
  chapter_title: { type: "string" },
  type: { type: "string" },
  level: { type: "string" },
  max_xp: { type: "integer" },
  statement: { type: "string" },
  solution: { type: "string" },
  hint: { type: "string" },
  correct_answer: { type: "string" },
  options: {
    type: "array",
    items: {
      type: "object",
      properties: {
        label: { type: "string" },
        text: { type: "string" },
        is_correct: { type: "boolean" },
      },
      required: ["label", "text", "is_correct"],
    },
  },
  tags: { type: "string" },
  is_visible: { type: "boolean" },
  is_formula: { type: "boolean" },
  is_concept: { type: "boolean" },
  is_pyq: { type: "boolean" },
  pyq_exam: { type: "string" },
  pyq_year: { type: "string" },
};

const FIX_TOOL = [
  {
    name: "return_question_data",
    description: "Return the fixed structured JEE question object.",
    input_schema: {
      type: "object",
      properties: QUESTION_SCHEMA,
      required: Object.keys(QUESTION_SCHEMA),
    },
  },
];

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "Missing ANTHROPIC_API_KEY in Cloudflare environment variables." }, 500);
    }

    const body = await request.json();
    const question = body.question || {};
    const fixPrompt = body.fix_prompt || "";

    if (!fixPrompt) {
      return json({ error: "No fix prompt provided" }, 400);
    }

    const prompt = `You are a precise JSON data editor.

Your ONLY job is to apply the user's specific request to the provided data.

User request:
${fixPrompt}

CRITICAL RULES:
1. Keep exact wording, length, formatting, line breaks, and LaTeX syntax for fields not mentioned.
2. Do not shorten the solution unless the user explicitly asks.
3. If the user says "fix the hint", only change the hint.
4. Return the updated full JSON object with the exact same structure.

Current data:
${JSON.stringify(question, null, 2)}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 2048,
        tools: FIX_TOOL,
        tool_choice: {
          type: "tool",
          name: "return_question_data",
        },
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Anthropic request failed");
    }

    const toolBlock = data.content?.find((block) => block.type === "tool_use");

    if (!toolBlock?.input) {
      throw new Error("Claude did not return fixed question data");
    }

    return json(toolBlock.input);
  } catch (error) {
    return json({ error: error.message || "Fix failed" }, 500);
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
