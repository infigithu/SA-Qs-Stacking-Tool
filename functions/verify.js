const VERIFY_TOOL = [
  {
    name: "return_verification",
    description: "Return the verification result.",
    input_schema: {
      type: "object",
      properties: {
        correct: { type: "boolean" },
        explanation: { type: "string" },
      },
      required: ["correct", "explanation"],
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

    const prompt = `You are a JEE Advanced solution checker.

Your job:
1. Read the question and solution carefully.
2. Check if the final answer matches the correct option or correct_answer field.
3. Check if the approach and conclusion are correct.
4. Do not re-derive from scratch. Validate the approach and final answer.
5. Be lenient if the final answer is correct and the method is reasonable.

Question:
${question.statement || ""}

Type:
${question.type || ""}

Options:
${JSON.stringify(question.options || [])}

Solution:
${question.solution || ""}

Correct Answer:
${question.correct_answer || ""}

Return ONLY:
{"correct": true, "explanation": "one line reason"}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 256,
        tools: VERIFY_TOOL,
        tool_choice: {
          type: "tool",
          name: "return_verification",
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
      throw new Error("Claude did not return verification data");
    }

    return json(toolBlock.input);
  } catch (error) {
    return json({ error: error.message || "Verify failed" }, 500);
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
