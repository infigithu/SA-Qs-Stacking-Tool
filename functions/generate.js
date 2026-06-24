const APPROVED_TAGS =
  "sets, union, intersection, complement, subset, power-set, cartesian-product, algebra, graph-based, inequalities, roots, nature-of-roots, discriminant, factorization, completing-the-square, max-min, ap, gp, hp, sum-of-n-terms, nth-term, telescoping, permutation, combination, binomial-coefficients, matrices, determinants, trigonometry, inverse-properties, limits, continuity, differentiability, derivatives, tangent-normal, maxima-minima, integrals, differential-equations, vectors, probability, statistics, formula-based, proof, application, conceptual, calculation-heavy";

const CHAPTER_LIST =
  "Units & Dimensions, Motion in One Dimension, Motion in Two Dimensions (Projectile Motion), Laws of Motion, Work Power & Energy, Centre of Mass, Rotational Motion, Gravitation, SHM, Waves (Sound & Mechanical), Kinetic Theory of Gases, Thermodynamics, Heat Transfer, Current Electricity, Capacitance, Moving Charges & Magnetism, Magnetism & Matter, Electromagnetic Waves, Electromagnetic Induction, Alternating Current, Ray Optics, Wave Optics, Dual Nature of Matter & Radiation, Atoms & Nuclei, Semiconductor Electronics, Communication Systems, Sets Relations & Functions, Complex Numbers, Quadratic Equations, Permutations & Combinations, Matrices & Determinants, Probability, Statistics, Limits & Continuity, Differentiation, Application of Derivatives, Definite Integrals, Differential Equations, Straight Lines, Circles, Parabola, Hyperbola, Ellipse, Vectors 2D, Vector 3D, Properties of Triangles, Heights & Distances, Functions, Circular Motion, Fluid Mechanics, Inverse Trignometry, Sequences & Series, Trigonometric Ratios & Identities, Indefinite Integrals, Electrostatics, Binomial Theorem, Applications of Derivatives, Sequence & Series, Principles of Communcation";

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

const GENERATE_TOOL = [
  {
    name: "return_question_data",
    description: "Return the fully structured JEE question object.",
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

    if (!env.OPENAI_API_KEY) {
      return json({ error: "Missing OPENAI_API_KEY in Cloudflare environment variables." }, 500);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "Missing ANTHROPIC_API_KEY in Cloudflare environment variables." }, 500);
    }

    const body = await request.json();
    const images = body.images || [];
    const solutionIncluded = Boolean(body.solution_included);

    if (!images.length) {
      return json({ error: "No images provided" }, 400);
    }

    const questionData = await extractQuestion(images, solutionIncluded, env);
    const result = await generateWithClaude(questionData, solutionIncluded, env);

    return json(result);
  } catch (error) {
    return json({ error: error.message || "Generate failed" }, 500);
  }
}

async function extractQuestion(imagesB64, solutionIncluded, env) {
  const content = imagesB64.map((img) => ({
    type: "image_url",
    image_url: {
      url: `data:image/jpeg;base64,${img}`,
    },
  }));

  const prompt = solutionIncluded
    ? `Extract the question AND solution from the provided image(s) exactly as given.

Rewrite the statement in fresh English phrasing while keeping ALL math identical.

All math must use $...$ for inline and $$...$$ for display equations.

Return ONLY a raw JSON object, no markdown fences:
{
  "statement": "rephrased question with all math in $...$",
  "type": "SCQ or MCQ or INT",
  "options": [
    {"label": "A", "text": "option in $...$", "is_correct": true or false},
    {"label": "B", "text": "option in $...$", "is_correct": false},
    {"label": "C", "text": "option in $...$", "is_correct": false},
    {"label": "D", "text": "option in $...$", "is_correct": false}
  ],
  "solution": "full solution preserving all math",
  "correct_answer": "numeric for INT, empty string for SCQ/MCQ"
}

For INT type options should be [].`
    : `Extract ONLY the question from the provided image(s). Do NOT generate a solution.

Rewrite the statement in fresh English phrasing while keeping ALL math identical.

All math must use $...$ for inline and $$...$$ for display equations.

Return ONLY a raw JSON object, no markdown fences:
{
  "statement": "rephrased question with all math in $...$",
  "type": "SCQ or MCQ or INT",
  "options": [
    {"label": "A", "text": "option in $...$", "is_correct": true or false},
    {"label": "B", "text": "option in $...$", "is_correct": false},
    {"label": "C", "text": "option in $...$", "is_correct": false},
    {"label": "D", "text": "option in $...$", "is_correct": false}
  ],
  "correct_answer": "numeric for INT if visible, empty string for SCQ/MCQ"
}

For INT type options should be [].`;

  content.push({
    type: "text",
    text: prompt,
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4o",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI request failed");
  }

  const raw = data.choices?.[0]?.message?.content;

  if (!raw) {
    throw new Error("OpenAI returned empty response");
  }

  return JSON.parse(raw);
}

async function generateWithClaude(questionData, solutionIncluded, env) {
  const statement = questionData.statement || "";
  const qType = questionData.type || "SCQ";
  const options = JSON.stringify(questionData.options || []);
  const solution = questionData.solution || "";
  const correctAnswer = questionData.correct_answer || "";

  const prompt = solutionIncluded
    ? `You are a JEE Advanced content formatter.

The solution is already provided. Do NOT change its mathematical content or logic.

Your tasks:
1. Fix LaTeX formatting.
2. Create title, subject, chapter, hint, tags, level, and metadata.
3. Update is_correct on options based on the solution.
4. For INT type, extract correct_answer as decimal if needed.

Formatting rules:
- Use $...$ for inline math.
- Use display equations like this only:
$$
equation here
$$
- Keep paragraphs short.
- Do not use aligned, gather, cases, or multiline environments.
- Never use \\neq. Write "is not equal to" instead.
- Make the title unique, emotional, and max 6 words.
- Do not use textbook-style titles.

CHAPTER LIST — chapter_title MUST match exactly one:
${CHAPTER_LIST}

APPROVED TAGS — choose EXACTLY 3:
${APPROVED_TAGS}

Return the full structured object.

Statement: ${statement}
Type: ${qType}
Options: ${options}
Solution: ${solution}
Correct Answer: ${correctAnswer}`
    : `You are an elite JEE Advanced expert.

Generate a complete solution and all fields.

Rules:
- Use only JEE-level math.
- Use $...$ for inline math.
- Use display equations like this only:
$$
equation here
$$
- Keep solution concise.
- Never use aligned, gather, cases, or multiline environments.
- Make the title unique, emotional, and max 6 words.
- Do not use textbook-style titles.

CHAPTER LIST — chapter_title MUST match exactly one:
${CHAPTER_LIST}

APPROVED TAGS — choose EXACTLY 3:
${APPROVED_TAGS}

Return the full structured object.

Statement: ${statement}
Type: ${qType}
Options: ${options}
Correct Answer hint: ${correctAnswer}`;

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
      tools: GENERATE_TOOL,
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
    throw new Error("Claude did not return structured question data");
  }

  return toolBlock.input;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
