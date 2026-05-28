import os
import io
import json
import base64
import httpx
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
# import anthropic
import google.generativeai as genai
import gspread
from google.oauth2.service_account import Credentials

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GOOGLE_CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON")
GOOGLE_SPREADSHEET_ID = os.getenv("GOOGLE_SPREADSHEET_ID")
GOOGLE_SHEET_NAME = os.getenv("GOOGLE_SHEET_NAME", "Sheet1")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

app = Flask(__name__, static_folder='static')
CORS(app)

openai_client = OpenAI(api_key=OPENAI_API_KEY)
genai.configure(api_key=GEMINI_API_KEY)
# anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

APPROVED_TAGS = """sets, union, intersection, complement, subset, power-set, cartesian-product, types-of-relations, equivalence-relation, types-of-functions, domain, range, codomain, inverse-function, composite-function, even-odd, periodic, graph-based, algebra, modulus, argument, conjugate, polar-form, euler-form, de-moivres-theorem, roots-of-unity, cube-roots-of-unity, geometry, locus, rotation, amplitude, real-imaginary-parts, inequalities, iota-powers, roots, nature-of-roots, discriminant, sum-of-roots, product-of-roots, factorization, completing-the-square, common-roots, symmetric-functions, transformation-of-roots, range-of-expression, sign-of-quadratic, max-min, ap, gp, hp, agp, sum-of-n-terms, nth-term, arithmetic-mean, geometric-mean, harmonic-mean, telescoping, vn-method, sum-of-squares, sum-of-cubes, infinite-gp, special-series, fundamental-principle, factorial, permutation, combination, circular-arrangement, identical-objects, distribution, selection, derangement, divisors, rank-of-word, grouping, at-least-at-most, gaps-method, expansion, general-term, middle-term, coefficient, greatest-term, independent-term, binomial-coefficients, properties, numerically-greatest-term, multinomial, sum-of-coefficients, divisibility, types-of-matrices, matrix-operations, transpose, adjoint, inverse, rank, determinant, properties-of-determinants, cofactors, system-of-equations, cramer-rule, consistency, skew-symmetric, orthogonal, elementary-operations, principle-of-induction, base-step, inductive-step, basic-ratios, pythagorean-identities, compound-angles, multiple-angles, sub-multiple-angles, product-to-sum, sum-to-product, allied-angles, conditional-identities, general-solution, principal-solution, sin-equation, cos-equation, tan-equation, quadratic-in-trig, multiple-angle-equations, domain-restricted, principal-value, identities, composition, simplification, inverse-properties, slope, forms-of-line, angle-between-lines, parallel, perpendicular, distance-formula, foot-of-perpendicular, image-of-point, family-of-lines, concurrency, area-of-triangle, section-formula, equation-of-circle, general-form, centre-radius, position-of-point, position-of-line, tangent, normal, chord-of-contact, pair-of-tangents, radical-axis, common-chord, family-of-circles, intercepts, standard-forms, focus-directrix, chord, parametric, pole-polar, conormal-points, reflection-property, standard-form, eccentricity, auxiliary-circle, conjugate-diameters, focal-chord, asymptotes, conjugate-hyperbola, rectangular-hyperbola, direct-substitution, indeterminate-forms, rationalization, standard-limits, lhopital, squeeze-theorem, trigonometric-limits, exponential-limits, logarithmic-limits, limits-at-infinity, continuity-at-point, continuity-in-interval, types-of-discontinuity, differentiability, left-right-derivatives, modulus-functions, greatest-integer, piecewise, first-principles, product-rule, quotient-rule, chain-rule, implicit-differentiation, parametric-differentiation, logarithmic-differentiation, higher-order-derivatives, differentiation-of-inverse-trig, tangent-normal, rate-of-change, increasing-decreasing, monotonicity, maxima-minima, first-derivative-test, second-derivative-test, rolles-theorem, lmvt, approximation, concavity-inflection, standard-integrals, substitution, by-parts, partial-fractions, trigonometric-integrals, reduction-formula, special-integrals, irrational-functions, integration-by-inspection, limits-of-integration, king-property, even-odd-property, periodic-functions, newton-leibniz, gamma-function, wallis-formula, area-under-curve, limit-as-sum, area-between-curves, area-with-x-axis, area-with-y-axis, shifting-graphs, absolute-value-functions, parametric-area, standard-areas, order-degree, variable-separable, homogeneous, linear-de, integrating-factor, bernoulli-equation, exact-de, formation-of-de, applications, clairaut-equation, types-of-vectors, addition, subtraction, scalar-multiplication, dot-product, cross-product, scalar-triple-product, vector-triple-product, collinearity, coplanarity, angle-between-vectors, projection, unit-vector, direction-cosines, direction-ratios, equation-of-line, equation-of-plane, angle-between-planes, distance-point-to-plane, skew-lines, shortest-distance, intersection, classical-probability, addition-theorem, conditional-probability, multiplication-theorem, bayes-theorem, total-probability, independent-events, mutually-exclusive, binomial-distribution, expected-value, odds, mean, median, mode, variance, standard-deviation, mean-deviation, frequency-distribution, grouped-data, combined-mean, combined-variance, coefficient-of-variation, statements, negation, conjunction, disjunction, implication, biconditional, contrapositive, converse, tautology, contradiction, quantifiers, validity-of-argument, theory, formula-based, proof, application, conceptual, calculation-heavy"""

CHAPTER_LIST = """Units & Dimensions, Motion in One Dimension, Motion in Two Dimensions (Projectile Motion), Laws of Motion, Work Power & Energy, Centre of Mass, Rotational Motion, Gravitation, SHM, Waves (Sound & Mechanical), Kinetic Theory of Gases, Thermodynamics, Heat Transfer, Current Electricity, Capacitance, Moving Charges & Magnetism, Magnetism & Matter, Electromagnetic Waves, Electromagnetic Induction, Alternating Current, Ray Optics, Wave Optics, Dual Nature of Matter & Radiation, Atoms & Nuclei, Semiconductor Electronics, Communication Systems, Sets Relations & Functions, Complex Numbers, Quadratic Equations, Permutations & Combinations, Matrices & Determinants, Probability, Statistics, Limits & Continuity, Differentiation, Application of Derivatives, Definite Integrals, Differential Equations, Straight Lines, Circles, Parabola, Hyperbola, Ellipse, Vectors 2D, Vector 3D, Properties of Triangles, Heights & Distances, Functions, Circular Motion, Fluid Mechanics, Inverse Trignometry, Sequences & Series, Trigonometric Ratios & Identities, Indefinite Integrals, Electrostatics, Binomial Theorem, Applications of Derivatives, Sequence & Series, Principles of Communcation"""


# ---------------------------------------------------------------------------
# Anthropic tool schemas
# ---------------------------------------------------------------------------

_OPTION_SCHEMA = {
    "type": "object",
    "properties": {
        "label":      {"type": "string"},
        "text":       {"type": "string"},
        "is_correct": {"type": "boolean"},
    },
    "required": ["label", "text", "is_correct"],
}

_QUESTION_PROPERTIES = {
    "title":          {"type": "string"},
    "subject":        {"type": "string"},
    "chapter_title":  {"type": "string"},
    "type":           {"type": "string"},
    "level":          {"type": "string"},
    "max_xp":         {"type": "integer"},
    "statement":      {"type": "string"},
    "solution":       {"type": "string"},
    "hint":           {"type": "string"},
    "correct_answer": {"type": "string"},
    "options":        {"type": "array", "items": _OPTION_SCHEMA},
    "tags":           {"type": "string"},
    "is_visible":     {"type": "boolean"},
    "is_formula":     {"type": "boolean"},
    "is_concept":     {"type": "boolean"},
    "is_pyq":         {"type": "boolean"},
    "pyq_exam":       {"type": "string"},
    "pyq_year":       {"type": "string"},
}
_QUESTION_REQUIRED = list(_QUESTION_PROPERTIES.keys())

GENERATE_TOOL = [{
    "name": "return_question_data",
    "description": "Return the fully structured JEE question object.",
    "input_schema": {
        "type": "object",
        "properties": _QUESTION_PROPERTIES,
        "required": _QUESTION_REQUIRED,
    },
}]

FIX_TOOL = GENERATE_TOOL 

VERIFY_TOOL = [{
    "name": "return_verification",
    "description": "Return the verification result.",
    "input_schema": {
        "type": "object",
        "properties": {
            "correct":     {"type": "boolean"},
            "explanation": {"type": "string"},
        },
        "required": ["correct", "explanation"],
    },
}]


# ---------------------------------------------------------------------------
# Google Sheets & Telegram helpers
# ---------------------------------------------------------------------------

def _get_gc():
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    if GOOGLE_CREDENTIALS_JSON:
        creds_dict = json.loads(GOOGLE_CREDENTIALS_JSON)
        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    # Otherwise, use the local file (like on your computer)
    else:
        creds = Credentials.from_service_account_file(GOOGLE_CREDENTIALS_FILE, scopes=scopes)
        
    return gspread.authorize(creds)

def get_sheet(spreadsheet_id, sheet_name):
    gc = _get_gc()
    return gc.open_by_key(spreadsheet_id).worksheet(sheet_name)

def send_images_to_telegram(title, q_images, s_images):
    """Sends base64 images directly to Telegram in memory."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    
    all_images = q_images + s_images
    if not all_images:
        return

    files = {}
    media = []
    
    for i, b64_str in enumerate(all_images):
        if b64_str.startswith("data:image"):
            b64_str = b64_str.split(",")[1]
        
        image_bytes = base64.b64decode(b64_str)
        file_name = f"image_{i}.jpg"
        files[file_name] = (file_name, image_bytes, "image/jpeg")
        
        media_item = {"type": "photo", "media": f"attach://{file_name}"}
        if i == 0:
            media_item["caption"] = title
        media.append(media_item)

    if len(all_images) == 1:
        # Single image logic
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
        data = {"chat_id": TELEGRAM_CHAT_ID, "caption": title}
        # files dict only needs "photo" key for sendPhoto
        single_file = {"photo": files["image_0.jpg"]}
        response = httpx.post(url, data=data, files=single_file, timeout=15.0)
        print(f"Telegram Response (Single): {response.text}")

    else:
        # Multiple images logic
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMediaGroup"
        data = {"chat_id": TELEGRAM_CHAT_ID, "media": json.dumps(media)}
        response = httpx.post(url, data=data, files=files, timeout=30.0)
        print(f"Telegram Response (Multi): {response.text}")

# ---------------------------------------------------------------------------
# extract_question
# ---------------------------------------------------------------------------

def extract_question(images_b64, solution_included):
    content = []
    for img in images_b64:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}})

    if solution_included:
        prompt = """Extract the question AND solution from the provided image(s) exactly as given.
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
For INT type options should be []."""
    else:
        prompt = """Extract ONLY the question from the provided image(s). Do NOT generate a solution.
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
For INT type options should be []."""

    content.append({"type": "text", "text": prompt})

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        max_tokens=4096,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": content}],
    )
    raw = response.choices[0].message.content
    print(f"GPT-4o RAW:\n{raw}\n---END---")
    return json.loads(raw)


# ---------------------------------------------------------------------------
# generate_with_claude
# ---------------------------------------------------------------------------

def generate_with_claude(question_data, solution_included):
    statement = question_data.get("statement", "")
    q_type = question_data.get("type", "SCQ")
    options = json.dumps(question_data.get("options", []))
    solution = question_data.get("solution", "")
    correct_answer = question_data.get("correct_answer", "")

    if solution_included:
        prompt = f"""You are a JEE Advanced content formatter. The solution is already provided — do NOT change its mathematical content or logic.

Your tasks:
1. Fix LaTeX formatting in the solution ONLY:
   - Replace \\(...\\) with $...$
   - Replace \\[...\\] with $$...$$
   - Remove \\displaystyle, aligned, cases, multiline environments
2. Create all other fields (title, hint, tags, etc.)
3. Update is_correct on options based on the solution.
4. For INT type: extract correct_answer as decimal (e.g. 82/3 = 27.33)




TITLE RULES:
Create a completely original, unexpected name for this question.

The name must feel like it belongs in one of these worlds — pick randomly each time:
- A Netflix show episode title
- A song name from an indie/alternative album  
- A chapter name from a dark fantasy novel
- A viral tweet that went emotional
- A late night thought at 3am
- A breakup text subject line
- A horror movie scene name
- A philosophy dissertation chapter
- A meme format title
- A sports documentary moment


UNIQUENESS RULE:
Before generating the title, look at the question statement and pick 2-3 random non-mathematical words or emotions that the question REMINDS you of (not what it's about). Use those as seeds to build the title.

For example:
- A question about limits might remind you of "waiting" → title becomes something about waiting
- A question about matrices might remind you of "structure" → title becomes something about architecture or bones
- A question about probability might remind you of "chance" → title becomes something about gambling or fate

This way every title is anchored to something unique about that specific question, making repetition virtually impossible across thousands of questions.

The name should:
- Evoke a strong emotion or image in the reader's mind
- Sound like it belongs in pop culture, not a textbook
- Be completely unpredictable and feel fresh
- Make someone curious enough to click on it

HARD RULES:
- Max 6 words
- NEVER reference the mathematical topic, concept, or solution
- NEVER use: enigma, paradox, mystery, phantom, chronicles, theorem, equation, function, derivative, integral, matrix, vector, proof, sigma, omega, cosmos, cosmic, cipher, polynomial
- Generate from scratch every time — do not follow a template
- Treat it like naming a piece of art, not a math problem


STATEMENT (QUESTION) FORMATTING — STRICT:
- NO PARAGRAPHS: Never write more than one sentence per block.
- BLANK LINES: You MUST insert a complete blank line between every single sentence, condition, or case.
- ISOLATE EQUATIONS: Any equation that sits on its own line MUST use this exact format:
  $$
  equation here
  $$
  The opening $$ must be on its own line, the equation on the next line, and the closing $$ on its own line.
- ISOLATE THE DIRECTIVE: The final sentence (e.g., "Find the value of X") must sit completely alone at the bottom with a blank line above it.
- STRICT MATH: Use $...$ for all inline math. NEVER use \aligned, \cases, \array, or \begin{...} inside the statement.
- SYMBOL REPLACEMENT: NEVER use the "not equal to" symbol (like ≠, !=, or \neq). You MUST write the plain text "is not equal to" instead.

TABLE FORMATTING RULES:
- If the question or solution contains a tabular format, please write tables using LaTeX array format inside double-dollar display math mode, like this:
  $$
  \\begin{{array}}{{|c|l|c|}}
  \\hline
  ...
  \\end{{array}}
  $$
- Use \\text{{}} for words inside the table.
- The opening $$ must be on its own line, the array on the next lines, and the closing $$ must be on its own line.


SOLUTION FORMATTING RULES:
- Each logical step in its own paragraph with a blank line between
- Never write equations longer than 40 characters inside $$...$$
- Use ONLY this exact format for display equations:
  $$
  equation here
  $$
- The opening $$ must be on its own line, the equation on the next line, and the closing $$ on its own line.
- Break long equations across multiple blocks, but always follow the 3-line $$ format.
- Prefer $...$ inline for short expressions
- SYMBOL REPLACEMENT: NEVER use the "not equal to" symbol (like ≠, !=, or \neq). You MUST write the plain text "is not equal to" instead.
- Never run two steps in the same $$ block
- Short text before each equation explaining what you're doing
- Never more than 2 lines of text before a display equation
- Show numerical substitution clearly
- End with a clear conclusion line
- No bullet points, no bold headers
- No walls of text — short paragraphs only
- Feel like a clean handwritten solution


CHAPTER LIST — chapter_title MUST match exactly one of these:
{CHAPTER_LIST}

APPROVED TAGS — choose EXACTLY 3 from this list only:
{APPROVED_TAGS}

CRITICAL: Your response must be valid JSON. All backslashes in LaTeX must be double-escaped. For example \\frac must be written as \\\\frac in the JSON output. Never use single backslashes in JSON string values.

Return ONLY raw JSON, no markdown fences:
{{
  "title": "...",
  "subject": "Mathematics or Physics or Chemistry",
  "chapter_title": "must match chapter list",
  "type": "{q_type}",
  "level": "Easy or Medium or Hard or Elite",
  "max_xp": <3-13>,
  "statement": "Rewrite the question in fresh English phrasing while strictly preserving the visual alignment and line breaks of the original image. All math MUST be in inline LaTeX using $...$ format. Display equations must be wrapped in $$ placed on separate lines.",
  "solution": "solution with ONLY formatting fixed",
  "hint": "2-3 lines guiding toward approach without revealing answer",
  "correct_answer": "decimal for INT, empty string for SCQ/MCQ",
  "options": {options},
  "tags": "tag1, tag2, tag3",
  "is_visible": true,
  "is_formula": false,
  "is_concept": false,
  "is_pyq": false,
  "pyq_exam": "",
  "pyq_year": ""
}}

Statement: {statement}
Type: {q_type}
Options: {options}
Solution (DO NOT CHANGE MATH): {solution}
Correct Answer: {correct_answer}"""
    else:
        prompt = f"""You are an elite JEE Advanced expert. Generate a complete solution and all fields.

STRICT CONTENT RULES:
- NEVER use modular arithmetic, mod notation, or number theory beyond JEE syllabus
- NEVER use group theory, ring theory, abstract algebra, or competition math
- Use ONLY: calculus, algebra, coordinate geometry, vectors, trigonometry, probability, matrices
- Every step must be understandable by a JEE Advanced student


STATEMENT (QUESTION) FORMATTING — STRICT:
- NO PARAGRAPHS: Never write more than one sentence per block.
- BLANK LINES: You MUST insert a complete blank line between every single sentence, condition, or case.
- ISOLATE EQUATIONS: Any equation that sits on its own line MUST use this exact format:
  $$
  equation here
  $$
  The opening $$ must be on its own line, the equation on the next line, and the closing $$ on its own line.
- ISOLATE THE DIRECTIVE: The final sentence (e.g., "Find the value of X") must sit completely alone at the bottom with a blank line above it.
- STRICT MATH: Use $...$ for all inline math. NEVER use \aligned, \cases, \array, or \begin{...} inside the statement.


TABLE FORMATTING RULES:
- If the question or solution contains a tabular format, please write tables using LaTeX array format inside double-dollar display math mode, like this:
  $$
  \\begin{{array}}{{|c|l|c|}}
  \\hline
  ...
  \\end{{array}}
  $$
- Use \\text{{}} for words inside the table.
- The opening $$ must be on its own line, the array on the next lines, and the closing $$ must be on its own line.


SOLUTION FORMATTING — STRICT:
- Each sentence on its own line
- Blank line between every step
- Never more than 15 words per line
- For MCQ: each option on its own block with a blank line before it
- Start each option with: **A)** or **B)** etc
- End each option with TRUE or FALSE on its own line
- Never run two options in same paragraph
- Use $...$ for all inline math
- Use ONLY this exact format for display equations:
  $$
  equation here
  $$
- The opening $$ must be on its own line, the equation on the next line, and the closing $$ on its own line.

STRICT FORMATTING RULES:
- Use $...$ for inline math ONLY
- NEVER use aligned, gather, array, cases, multiline environments
- Solution max 8-10 lines. Skip obvious algebra. Jump to key steps only.

SOLUTION STRUCTURE FOR MCQ (multiple correct type):
- Start with 1-2 lines of key setup/observation
- Then handle each option in its own block:

**A** — [one line conclusion] TRUE or FALSE
[2-3 lines of working, each step on new line]
$$
key equation
$$

- Never run option analyses together in one paragraph
- Each option block must be visually separated
- Keep each option analysis under 4 lines
- State TRUE/FALSE clearly at the start of each option block
- No bold mid-sentence
- Mobile-first: short lines, generous spacing between option blocks


TITLE RULES: Generate a wildly unique name. Pick ONE random style from: [GenZ slang, horror, anime arc, philosophical paradox, villain monologue, cursed prophecy, unhinged academic, poetic tragedy, sigma grindset, existential dread]. The name must feel NOTHING like a math problem. Never use words like enigma, paradox, mystery, cosmic, phantom. Max 6 words. NO hinting at solution.

CHAPTER LIST — chapter_title MUST match exactly one of these:
{CHAPTER_LIST}

APPROVED TAGS — choose EXACTLY 3 from this list only:
{APPROVED_TAGS}

CRITICAL: Your response must be valid JSON. All backslashes in LaTeX must be double-escaped. For example \\frac must be written as \\\\frac in the JSON output. Never use single backslashes in JSON string values.

Return ONLY raw JSON, no markdown fences:
{{
  "title": "...",
  "subject": "Mathematics or Physics or Chemistry",
  "chapter_title": "must match chapter list",
  "type": "{q_type}",
  "level": "Easy or Medium or Hard or Elite",
  "max_xp": <3-13>,
  "statement": "Rewrite the question in fresh English phrasing while strictly preserving the visual alignment and line breaks of the original image. All math MUST be in inline LaTeX using $...$ format. Display equations must be wrapped in $$ placed on separate lines.",
  "solution": "concise elegant solution, max 8-10 lines",
  "hint": "2-3 lines guiding toward approach without revealing answer",
  "correct_answer": "decimal for INT, empty string for SCQ/MCQ",
  "options": {options},
  "tags": "tag1, tag2, tag3",
  "is_visible": true,
  "is_formula": false,
  "is_concept": false,
  "is_pyq": false,
  "pyq_exam": "",
  "pyq_year": ""
}}

Statement: {statement}
Type: {q_type}
Options: {options}
Correct Answer hint: {correct_answer}"""

    # response = anthropic_client.messages.create(
    #     model="claude-haiku-4-5-20251001",
    #     max_tokens=4096,
    #     tools=GENERATE_TOOL,
    #     tool_choice={"type": "tool", "name": "return_question_data"},
    #     messages=[{"role": "user", "content": prompt}],
    # )
    # tool_block = next(b for b in response.content if b.type == "tool_use")
    # return tool_block.input



    # Using Gemini 1.5 Pro for high-level reasoning (or gemini-1.5-flash for maximum speed)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    response = model.generate_content(
        prompt,
        generation_config={
            "response_mime_type": "application/json",
            "temperature": 0.2
        }
    )
    
    # Gemini directly returns the JSON string, so we parse it and return it
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/generate', methods=['POST'])
def generate():
    try:
        data = request.json
        images = data.get('images', [])
        solution_included = data.get('solution_included', False)

        if not images:
            return jsonify({'error': 'No images provided'}), 400

        question_data = extract_question(images, solution_included)
        result = generate_with_claude(question_data, solution_included)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/fix', methods=['POST'])
def fix():
    try:
        data = request.json
        question = data.get('question', {})
        fix_prompt = data.get('fix_prompt', '')

        prompt = f"""You are a JEE Advanced content editor. Fix the following question data based on the user's request.

User request: {fix_prompt}

Current data:
Statement: {question.get('statement', '')}
Solution: {question.get('solution', '')}
Hint: {question.get('hint', '')}
Title: {question.get('title', '')}

FORMATTING RULES:
- Use $...$ for inline math ONLY
- Use $$...$$ for display equations, ONE per block, single line only
- NEVER use aligned, gather, array, cases, multiline environments
- Solution max 8-10 lines

Return ONLY the updated full JSON object with same structure, no markdown fences:
{json.dumps(question, indent=2)}"""

        # response = anthropic_client.messages.create(
        #     model="claude-haiku-4-5-20251001",
        #     max_tokens=4096,
        #     tools=FIX_TOOL,
        #     tool_choice={"type": "tool", "name": "return_question_data"},
        #     messages=[{"role": "user", "content": prompt}],
        # )

        
        response = model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return jsonify(json.loads(response.text))

        
        tool_block = next(b for b in response.content if b.type == "tool_use")
        return jsonify(tool_block.input)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/verify', methods=['POST'])
def verify():
    try:
        data = request.json
        question = data.get('question', {})

        prompt = f"""You are a JEE Advanced solution checker. Your job is simple:

1. Read the question and solution carefully
2. Check if the final answer matches the correct option or correct_answer field
3. Check if the overall approach and conclusion is correct
4. Do NOT re-derive from scratch — just validate the approach and final answer

Be lenient — if the final answer is correct and the approach is reasonable, mark it as correct even if intermediate steps could be written more elegantly.

Question: {question.get('statement', '')}
Type: {question.get('type', '')}
Options: {json.dumps(question.get('options', []))}
Solution: {question.get('solution', '')}
Correct Answer: {question.get('correct_answer', '')}

Return ONLY this JSON, no extra text, no markdown:
{{"correct": true, "explanation": "one line reason"}}"""

        # response = anthropic_client.messages.create(
        #     model="claude-haiku-4-5-20251001",
        #     max_tokens=256,
        #     tools=VERIFY_TOOL,
        #     tool_choice={"type": "tool", "name": "return_verification"},
        #     messages=[{"role": "user", "content": prompt}],
        # )


        
        response = model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return jsonify(json.loads(response.text))

        
        tool_block = next(b for b in response.content if b.type == "tool_use")
        return jsonify(tool_block.input)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/get_sheets', methods=['GET'])
def get_sheets():
    """Return all worksheet (sub-sheet) names for the provided spreadsheet ID."""
    try:
        spreadsheet_id = request.args.get('spreadsheet_id')
        if not spreadsheet_id:
            spreadsheet_id = GOOGLE_SPREADSHEET_ID
            
        gc = _get_gc()
        spreadsheet = gc.open_by_key(spreadsheet_id)
        sheet_names = [ws.title for ws in spreadsheet.worksheets()]
        return jsonify({'sheets': sheet_names})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/send', methods=['POST'])
def send():
    try:
        data = request.json
        questions = data.get('questions', [])
        
        spreadsheet_id = data.get('spreadsheet_id') or GOOGLE_SPREADSHEET_ID
        sheet_name = data.get('sheet_name') or GOOGLE_SHEET_NAME
        sheet = get_sheet(spreadsheet_id, sheet_name)
        
        sent = 0

        for q in questions:
            # 1. Handle Telegram Images if switch is on
            has_figures = q.get('has_figures', False)
            if has_figures:
                q_images = q.get('question_figures', [])
                s_images = q.get('solution_figures', [])
                title = q.get("title", "Untitled Question")
                send_images_to_telegram(title, q_images, s_images)
            
            # 2. Append to Google Sheets
            options = q.get("options", [])
            options_str = json.dumps(options) if isinstance(options, list) else options
            row = [
                q.get("title", ""), q.get("chapter_title", ""), q.get("subject", ""),
                q.get("type", ""), q.get("level", ""), q.get("max_xp", ""),
                q.get("statement", ""), q.get("solution", ""), q.get("hint", ""),
                q.get("correct_answer", ""), options_str, q.get("tags", ""),
                q.get("is_visible", True), q.get("is_formula", False),
                q.get("is_concept", False), q.get("is_pyq", False),
                q.get("pyq_exam", ""), q.get("pyq_year", ""),
                has_figures # New Column appended at the end
            ]
            sheet.append_row(row, value_input_option="RAW")
            sent += 1

        return jsonify({'sent': sent, 'message': f'{sent} question(s) saved to "{sheet_name}"!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Get the port from Railway, default to 5000 for local testing
    port = int(os.environ.get('PORT', 5000))
    # host='0.0.0.0' tells the app to listen to the outside internet
    app.run(host='0.0.0.0', port=port, debug=False)
