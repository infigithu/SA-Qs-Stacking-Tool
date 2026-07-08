const VERIFY_TOOL = [
  {
    name: "return_verification",
    description: "Return the verification result.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pass", "warning", "fail"],
        },
        can_send: {
          type: "boolean",
        },
        explanation: {
          type: "string",
        },
        inferred_answer: {
          type: "string",
        },
        suggested_final_line: {
          type: "string",
        },
      },
      required: [
        "status",
        "can_send",
        "explanation",
        "inferred_answer",
        "suggested_final_line",
      ],
    },
  },
];

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.ANTHROPIC_API_KEY) {
      return json(
        { error: "Missing ANTHROPIC_API_KEY in Cloudflare environment variables." },
        500
      );
    }

    const body = await request.json();
    const question = body.question || {};

    const prompt = `You are a JEE Advanced solution verifier.

Your job is to verify whether this question can be safely sent to the sheet.

Important:
Do NOT reject only because the solution does not explicitly write the final option label.
If the solution logically reaches a result that matches the marked correct option(s), mark it as pass.
If the solution is correct but the final option/conclusion line is missing, mark it as warning and allow sending.
Only mark fail if the solution is mathematically wrong, incomplete in a way that answer cannot be inferred, or the marked correct option(s) are inconsistent.

Verification rules:
1. For SCQ/MCQ, use options where is_correct is true as the source of truth.
2. For INT, use correct_answer as the source of truth.
3. Compare mathematical equivalence, not exact text.
4. You may do light checking or substitution if the final answer is not explicitly written.
5. Do not require the solution to end with "Option A/B/C/D".
6. If the solution supports the marked option but lacks final line, return status "warning", can_send true.
7. If the solution clearly supports the correct answer and also has a clear final conclusion, return status "pass", can_send true.
8. If the solution is wrong or the marked correct option is inconsistent, return status "fail", can_send false.

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

Return ONLY JSON:
{
  "status": "pass | warning | fail",
  "can_send": true or false,
  "explanation": "one line reason",
  "inferred_answer": "option label(s) or numeric answer if inferable, else empty",
  "suggested_final_line": "final line to add if missing, else empty"
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 512,
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
