const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Extract a balanced JSON array slice starting at the first '[' (string-aware for " quotes).
 * @param {string} text
 * @returns {string|null}
 */
function extractBalancedJsonArray(text) {
  const s = String(text || '');
  const start = s.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '[') depth++;
    if (c === ']') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * @param {string} raw
 * @returns {any}
 */
function parseLenientJsonArray(raw) {
  let cleaned = String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/```json?\n?/gi, '')
    .replace(/```/g, '')
    // Normalize only curly double quotes; keep apostrophes (’)
    // because they are valid inside JSON strings and common in FR/EN text.
    .replace(/[\u201c\u201d]/g, '"')
    .trim();

  const tryParse = (str) => {
    let t = str.trim();
    const attempts = [t, t.replace(/,\s*([\]}])/g, '$1')];
    for (const a of attempts) {
      try {
        return JSON.parse(a);
      } catch {
        // continue
      }
    }
    return null;
  };

  let parsed = tryParse(cleaned);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.data)) return parsed.data;

  const slice = extractBalancedJsonArray(cleaned) || cleaned.match(/\[[\s\S]*\]/)?.[0];
  if (slice) {
    parsed = tryParse(slice);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
  }

  return null;
}

/**
 * Try to obtain an array of excerpt objects from model output (bare array or JSON object wrapper).
 * @param {string} raw
 * @returns {Array|null}
 */
function extractArrayFromModelJson(raw) {
  const fromArray = parseLenientJsonArray(raw);
  if (Array.isArray(fromArray) && fromArray.length) return fromArray;

  let cleaned = String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/```json?\n?/gi, '')
    .replace(/```/g, '')
    // Normalize only curly double quotes; keep apostrophes (’)
    // because they are valid inside JSON strings and common in FR/EN text.
    .replace(/[\u201c\u201d]/g, '"')
    .trim();

  const attempts = [cleaned, cleaned.replace(/,\s*([\]}])/g, '$1')];
  for (const t of attempts) {
    try {
      const o = JSON.parse(t);
      if (Array.isArray(o) && o.length) return o;
      if (o && typeof o === 'object') {
        for (const k of ['excerpts', 'items', 'data', 'suggestions', 'results', 'examples']) {
          if (Array.isArray(o[k]) && o[k].length) return o[k];
        }
      }
    } catch {
      // continue
    }
  }
  return null;
}

const CYRILLIC_RE = /[\u0400-\u04FF]/;
const COURSE_LOCALES_ALLOW_CYRILLIC = new Set(['ru', 'uk', 'be', 'bg', 'sr', 'mk']);

/**
 * For Latin-script courses, reject outputs that slipped Cyrillic into excerpt fields.
 * (LLMs are non-deterministic; same code path can still produce invalid language mix.)
 */
function excerptsPassScriptGate(items, langCode) {
  const code = String(langCode || 'en').toLowerCase();
  if (COURSE_LOCALES_ALLOW_CYRILLIC.has(code)) return Array.isArray(items) && items.length > 0;
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every((it) => {
    const blob = `${it.passage || ''}${it.highlight || ''}${it.book_title || ''}${it.author || ''}${it.context_note || ''}`;
    return !CYRILLIC_RE.test(blob);
  });
}

function normalizeExcerptItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => ({
      passage: String(item?.passage || '').trim(),
      highlight: String(item?.highlight || '').trim(),
      book_title: String(item?.book_title || '').trim(),
      author: String(item?.author || '').trim(),
      page_hint: item?.page_hint ? String(item.page_hint).trim() : null,
      context_note: item?.context_note ? String(item.context_note).trim() : null,
    }))
    .filter((item) => item.passage);
}

function filterExcerptItemsByScript(items, langCode) {
  const code = String(langCode || 'en').toLowerCase();
  if (COURSE_LOCALES_ALLOW_CYRILLIC.has(code)) return Array.isArray(items) ? items : [];
  if (!Array.isArray(items)) return [];
  return items.filter((it) => {
    const blob = `${it.passage || ''}${it.highlight || ''}${it.book_title || ''}${it.author || ''}`;
    return !CYRILLIC_RE.test(blob);
  });
}

/**
 * Last-resort sanitizer: ask the model to reformat its own output into strict JSON array.
 * This avoids failing the whole flow when the first response has wrappers/comments/markdown.
 */
async function repairExcerptOutputToJsonArray(raw, langName, langCode, count) {
  const systemPrompt =
    'You are a JSON repair assistant. Return only valid JSON array, no markdown, no comments.';
  const userPrompt =
    `Fix the malformed model output below and convert it to a strict JSON array with up to ${count} objects.\n` +
    `Language target for literary fields: ${langName} (${langCode}).\n` +
    'Each object must be exactly: ' +
    '{"passage":"...","highlight":"...","book_title":"...","author":"...","page_hint":"...","context_note":"..."}\n' +
    'Rules:\n' +
    '- Keep only plausible excerpt objects from the input.\n' +
    '- If highlight is not exact substring of passage, set highlight to "". \n' +
    '- Keep empty string for missing text fields; do not add extra keys.\n' +
    '- Return ONLY one JSON array.\n\n' +
    `Input to repair:\n${String(raw || '').slice(0, 16000)}`;
  try {
    return await callAI(systemPrompt, userPrompt, {
      maxTokens: 2800,
      timeoutMs: 90000,
      temperature: 0,
    });
  } catch {
    return '';
  }
}

/**
 * Second LLM pass: models often put English in context_note/page_hint even when the course is French, etc.
 * Rewrites only those fields; leaves passage/highlight/book_title/author unchanged.
 * @param {Array<object>} items
 * @param {string} langName
 * @param {string} langCode
 */
async function localizeExcerptNotesToCourseLanguage(items, langName, langCode) {
  if (!Array.isArray(items) || items.length === 0) return items;
  if (String(langCode || 'en').toLowerCase() === 'en') return items;

  const payload = items.map((it) => ({
    context_note: it.context_note || '',
    page_hint: it.page_hint == null ? '' : String(it.page_hint),
  }));

  const systemPrompt =
    'You output only valid JSON (no markdown fences, no commentary before or after the JSON).';

  const userPrompt =
    `Course language for learners: ${langName} (ISO ${String(langCode).toLowerCase()}).\n` +
    'You receive a JSON array (same order as excerpts). Each object has "context_note" and "page_hint" strings.\n' +
    `Rewrite every non-empty "context_note" fully in ${langName} as ONE clear sentence explaining the grammar point.\n` +
    `Rewrite every non-empty "page_hint" using ${langName} conventions (e.g. French "Chapitre 3", not English "Chapter 3").\n` +
    `Remove English from those two fields. Do not add facts not implied by the input.\n` +
    'Return ONLY a JSON array of the SAME length. Each element must be exactly: {"context_note":"...","page_hint":...}\n' +
    'Use JSON null for page_hint when the input page_hint was empty.\n' +
    `Input:\n${JSON.stringify(payload)}`;

  try {
    const raw = await callAI(systemPrompt, userPrompt, {
      maxTokens: 2800,
      timeoutMs: 120000,
      temperature: 0.05,
    });
    const arr = extractArrayFromModelJson(raw);
    if (!Array.isArray(arr) || arr.length !== items.length) {
      logger.warn(
        { expected: items.length, got: Array.isArray(arr) ? arr.length : 0 },
        'localizeExcerptNotesToCourseLanguage: bad array length'
      );
      return items;
    }
    return items.map((it, idx) => {
      const row = arr[idx] || {};
      let pageHint = row.page_hint;
      if (pageHint === undefined || pageHint === null || String(pageHint).trim() === '') {
        pageHint = it.page_hint;
      } else {
        pageHint = String(pageHint).trim() || null;
      }
      const cn = String(row.context_note ?? it.context_note ?? '').trim();
      return {
        ...it,
        context_note: cn || it.context_note,
        page_hint: pageHint,
      };
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'localizeExcerptNotesToCourseLanguage failed');
    return items;
  }
}

async function callAI(systemPrompt, userPrompt, opts = {}) {
  const apiKey = config.ai.openRouterApiKey;
  const configuredModels = String(config.ai.openRouterModel || '')
    .split(',')
    .map((m) => String(m || '').trim().replace(/,+$/, ''))
    .filter(Boolean);
  // Keep several modern free-model fallbacks: OpenRouter free endpoints rotate over time.
  const fallbackModels = [
    'openai/gpt-oss-20b:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-26b-a4b-it:free',
  ];
  const modelsToTry = [...configuredModels, ...fallbackModels].filter(
    (model, idx, arr) => model && arr.indexOf(model) === idx
  );
  if (!apiKey) {
    throw new AppError(
      'AI API key not configured. Set OPENROUTER_API_KEY in server/.env',
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  let lastStatus = null;
  let lastMessage = null;
  let lastModel = null;

  const maxTokens = opts.maxTokens ?? 1200;
  const timeoutMs = opts.timeoutMs ?? 90000;
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.4;

  for (const model of modelsToTry) {
    try {
      const body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      };
      if (opts.responseFormat && opts.responseFormat.type) {
        body.response_format = opts.responseFormat;
      }

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        body,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: timeoutMs,
        }
      );

      return response.data.choices[0].message.content;
    } catch (err) {
      const status = err.response?.status;
      const upstreamMessage =
        err.response?.data?.error?.message
        || err.response?.data?.message
        || err.message;
      lastStatus = status || null;
      lastMessage = upstreamMessage;
      lastModel = model;
      logger.error(
        {
          err: err.message,
          model,
          status,
          response: err.response?.data,
        },
        'AI API call failed'
      );
      if (status === 401 || status === 403) {
        // Wrong/expired API key — no fallback helps, surface a clear message.
        throw new AppError(
          `AI provider rejected the API key (HTTP ${status}). Update OPENROUTER_API_KEY in server/.env.`,
          503,
          'AI_AUTH_ERROR'
        );
      }
      // For 400 ("model not found" and similar) and 404/408/429/5xx — try next model.
    }
  }

  const detail = lastStatus
    ? ` (last upstream status ${lastStatus}${lastMessage ? `: ${lastMessage}` : ''}; model ${lastModel || 'n/a'})`
    : '';
  throw new AppError(`AI service unavailable${detail}`, 503, 'AI_ERROR');
}

/**
 * Suggest literary excerpts for a grammar rule.
 * Same algorithm for every rule; LLM outputs are non-deterministic, so we validate and may retry once.
 * @param {object} rule - bundle from loadRuleForAdminAi
 * @param {number} count
 * @returns {Promise<Array>}
 */
async function suggestExcerpts(rule, count = 5) {
  const langName = String(rule.excerpt_language_name || 'English').trim();
  const langCode = String(rule.excerpt_language_code || 'en').trim().slice(0, 10);
  const courseIsEnglish = String(langCode).toLowerCase() === 'en';

  let lastContent = '';
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const summaryMax = attempt === 1 ? 1800 : 520;
    const grammarHeading = {
      course_category: String(rule.grammar_category_title || '').trim().slice(0, 200),
      rule_title: String(rule.grammar_rule_title || '').trim().slice(0, 300),
      rule_summary: String(rule.grammar_rule_summary || '').trim().slice(0, summaryMax),
    };

    const meta = {
      excerpt_language: { name: langName, iso639_1: langCode },
      grammar_heading: grammarHeading,
    };
    // For Latin-script courses, do not pass Cyrillic-only reference locales: the model often
    // echoes Russian for future-tense rules ("будущее …") even when excerpts must be English.
    if (rule.other_locale_notes && rule.other_locale_notes.length > 0) {
      if (COURSE_LOCALES_ALLOW_CYRILLIC.has(langCode.toLowerCase())) {
        meta.other_language_references_for_meaning_only = rule.other_locale_notes;
      } else {
        const nonCyrillicRefs = rule.other_locale_notes.filter(
          (n) => !CYRILLIC_RE.test(`${n.title || ''}${n.summary || ''}`)
        );
        if (nonCyrillicRefs.length > 0) {
          meta.other_language_references_for_meaning_only = nonCyrillicRefs;
        }
      }
    }

    const ruleBlock = JSON.stringify(meta);

    const retryHint =
      attempt > 1
        ? `RETRY: Previous output was invalid (malformed JSON and/or wrong language/script). ` +
          (!courseIsEnglish
            ? `For course language ${langCode}, "context_note" and "page_hint" must not stay in English. `
            : '') +
          'Obey every constraint.\n'
        : '';

    const latinNoCyrillic = !COURSE_LOCALES_ALLOW_CYRILLIC.has(langCode.toLowerCase())
      ? `SCRIPT: For course code "${langCode}", the fields passage, highlight, book_title, and author must contain ONLY Latin script (A–Z, a–z, standard punctuation). Do NOT output Cyrillic characters in those fields.\n`
      : '';

    const learnerNotesLang = courseIsEnglish
      ? `- "page_hint" (optional) and "context_note" must be in English.\n`
      : `- "page_hint" (optional) and "context_note" MUST be written entirely in ${langName} (code ${langCode}), using natural vocabulary of that language.\n` +
        `- Do NOT write "context_note" or "page_hint" in English. Learner-facing explanations must match the course language.\n` +
        `- "context_note" must be one concise sentence explaining why this fragment illustrates the rule.\n` +
        `- For location hints, use the conventional wording of ${langName} (e.g. French "Chapitre 3" / "p. 12", not English "Chapter 3").\n`;

    const systemPrompt =
      `You are a language-learning content specialist. Output only valid JSON. ` +
      `Literary excerpts (passage, highlight, book_title, author) MUST be written in ${langName} (language code: ${langCode}). ` +
      (courseIsEnglish
        ? `Pedagogical notes may be in English.`
        : `Pedagogical notes ("context_note", "page_hint") MUST also be in ${langName}, never default to English.`) +
      (attempt > 1 ? ' No markdown fences. No text before or after the JSON array.' : '');

    const userPrompt =
      retryHint +
      `Metadata (JSON). Do not echo it; use only to choose grammatically correct excerpts.\n${ruleBlock}\n\n` +
      latinNoCyrillic +
      `TASK: Return ${count} short excerpts (1–3 sentences each) from well-known published literary works written in ${langName} that clearly demonstrate ONLY the stated grammar rule.\n` +
      `STRICT LANGUAGE:\n` +
      `- "passage", "highlight", "book_title", "author" must be entirely in ${langName} (code ${langCode}).\n` +
      `- If other_language_references_for_meaning_only exists, use it only to understand the rule — never copy its wording into passage/highlight.\n` +
      learnerNotesLang +
      `- "highlight" must be an exact substring of "passage".\n` +
      `- Escape double quotes inside strings as \\".\n` +
      `Return ONLY one JSON array (starts with "[" and ends with "]") in this shape:\n` +
      `[{"passage":"...","highlight":"...","book_title":"...","author":"...","page_hint":"...","context_note":"..."}]`;

    const content = await callAI(systemPrompt, userPrompt, {
      maxTokens: attempt === 1 ? 4096 : 4600,
      timeoutMs: 120000,
      temperature: attempt === 1 ? 0.22 : 0.12,
    });
    lastContent = content;

    let parsed = extractArrayFromModelJson(content);
    let items = normalizeExcerptItems(parsed);
    let scriptSafeItems = filterExcerptItemsByScript(items, langCode);

    // If first parse fails (or all items violate script gate), try one repair pass.
    if (scriptSafeItems.length === 0) {
      const repairedRaw = await repairExcerptOutputToJsonArray(content, langName, langCode, count);
      if (repairedRaw) {
        parsed = extractArrayFromModelJson(repairedRaw);
        items = normalizeExcerptItems(parsed);
        scriptSafeItems = filterExcerptItemsByScript(items, langCode);
      }
    }

    if (scriptSafeItems.length > 0) {
      if (!courseIsEnglish) {
        const localized = await localizeExcerptNotesToCourseLanguage(scriptSafeItems, langName, langCode);
        const localizedSafe = filterExcerptItemsByScript(localized, langCode);
        return localizedSafe.length > 0 ? localizedSafe : scriptSafeItems;
      }
      return scriptSafeItems;
    }

    logger.warn(
      {
        attempt,
        langCode,
        parsedLength: Array.isArray(parsed) ? parsed.length : 0,
        normalizedCount: items.length,
        scriptSafeCount: scriptSafeItems.length,
      },
      'AI excerpt batch rejected (parse or script gate)'
    );
  }

  logger.warn({ content: String(lastContent || '').slice(0, 2000) }, 'Failed to parse or validate AI excerpt suggestions');
  throw new AppError(
    'Failed to parse AI response or the model mixed languages/scripts. Try again or change OPENROUTER_MODEL.',
    502,
    'AI_PARSE_ERROR'
  );
}

/**
 * Suggest a grammar summary for a rule.
 * @param {object} rule - bundle from loadRuleForAdminAi
 * @returns {Promise<string>}
 */
async function suggestSummary(rule) {
  const langName = String(rule.excerpt_language_name || 'English').trim();
  const title = String(rule.grammar_rule_title || '').trim();
  const category = String(rule.grammar_category_title || '').trim();
  const ruleSummary = String(rule.grammar_rule_summary || '').trim().slice(0, 1400);

  const systemPrompt =
    `You are a language-learning content creator. Write clearly for learners studying ${langName}.`;

  const userPrompt = `Write a concise grammar explanation (2-4 paragraphs) for the rule below.
Category (in course language): ${JSON.stringify(category)}
Rule title (in course language): ${JSON.stringify(title)}
Existing rule summary / notes (in course language, may be brief): ${JSON.stringify(ruleSummary)}
Include when to use it, common patterns, and typical mistakes.
Write the ENTIRE explanation in ${langName} only (no mixed languages).
Return ONLY plain text — no markdown headings, no bullet markdown.`;

  return callAI(systemPrompt, userPrompt, { maxTokens: 2048, timeoutMs: 120000 });
}

/**
 * Attach best-matching grammar rule, highlight, and explanation to snippets.
 * @param {Array} snippets - [{ passage, ... }]
 * @param {Array} rules - [{ id, title, summary }]
 * @returns {Promise<Array>}
 */
async function annotateSnippetsWithRules(snippets, rules) {
  const safeSnippets = Array.isArray(snippets) ? snippets : [];
  const safeRules = Array.isArray(rules) ? rules : [];
  if (safeSnippets.length === 0 || safeRules.length === 0) return safeSnippets;

  const compactRules = safeRules
    .map((r) => ({
      id: Number(r.id),
      title: String(r.title || '').trim(),
      summary: String(r.summary || '').trim(),
    }))
    .filter((r) => r.id && r.title)
    .slice(0, 120);
  if (compactRules.length === 0) return safeSnippets;

  const systemPrompt = 'You are an expert English grammar tutor. Classify literary snippets by grammar rule with strict evidence from text.';
  const userPrompt = `You are given:
1) A list of grammar rules with IDs.
2) A list of literary snippets.

Task for EACH snippet:
- pick ONE best matching rule from the provided rule IDs;
- provide "highlight" as an exact substring from the snippet that demonstrates the selected rule;
- provide "context_note" in Russian (1-2 short sentences) explaining WHY this fragment demonstrates the chosen rule in this exact sentence.
- NEVER mention words that are absent in the snippet.
- If no reliable rule match exists, set "rule_id": null and leave "highlight": "".

Output format: valid JSON array only, same order and length as snippets.
Each item:
{ "rule_id": number, "highlight": string, "context_note": string }

Rules:
${JSON.stringify(compactRules)}

Snippets:
${JSON.stringify(safeSnippets.map((s) => ({ passage: String(s.passage || '').trim() })))}
`;

  const content = await callAI(systemPrompt, userPrompt);
  let items = [];
  try {
    const cleaned = content.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : []);
  } catch {
    const cleaned = content.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        items = Array.isArray(parsed) ? parsed : [];
      } catch {
        items = [];
      }
    }
  }
  if (!Array.isArray(items) || items.length === 0) return safeSnippets;

  return safeSnippets.map((snippet, idx) => {
    const item = items[idx] || {};
    return {
      ...snippet,
      rule_id: Number(item.rule_id) || snippet.rule_id || null,
      highlight: String(item.highlight || snippet.highlight || '').trim() || snippet.highlight || null,
      context_note: String(item.context_note || snippet.context_note || '').trim() || snippet.context_note || null,
    };
  });
}

/**
 * Re-annotate one snippet with stricter constraints.
 * @param {object} snippet
 * @param {Array} rules
 * @returns {Promise<object|null>}
 */
async function annotateSingleSnippetWithRule(snippet, rules) {
  const safeSnippet = snippet || {};
  const safeRules = Array.isArray(rules) ? rules : [];
  if (!safeSnippet.passage || safeRules.length === 0) return null;

  const compactRules = safeRules
    .map((r) => ({
      id: Number(r.id),
      title: String(r.title || '').trim(),
      summary: String(r.summary || '').trim(),
    }))
    .filter((r) => r.id && r.title)
    .slice(0, 120);
  if (compactRules.length === 0) return null;

  const systemPrompt = 'You are a strict grammar reviewer. Output only proven annotations from exact text evidence.';
  const userPrompt = `Task: annotate ONE snippet with ONE best grammar rule from provided IDs.
Return valid JSON object only:
{ "rule_id": number|null, "highlight": string, "context_note": string }

Hard constraints:
- "highlight" must be exact substring from snippet.
- Do not invent words.
- context_note in Russian, concrete, tied to this exact highlight.
- If uncertain: {"rule_id": null, "highlight": "", "context_note": ""}

Rules:
${JSON.stringify(compactRules)}

Snippet:
${JSON.stringify({ passage: String(safeSnippet.passage || '') })}
`;

  const content = await callAI(systemPrompt, userPrompt);
  const cleaned = content.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    rule_id: parsed?.rule_id == null ? null : Number(parsed.rule_id),
    highlight: String(parsed?.highlight || '').trim(),
    context_note: String(parsed?.context_note || '').trim(),
  };
}

/**
 * Find rule-specific snippets from text blocks (page/chapter chunks).
 * @param {object} params
 * @param {object} params.rule - { id, title, summary }
 * @param {Array} params.blocks - [{ block_id, page_number, chapter, text }]
 * @param {number} params.count
 * @returns {Promise<Array>}
 */
async function suggestSnippetsForRuleFromBlocks({ rule, blocks, count = 5 }) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  if (!rule?.title || safeBlocks.length === 0) return [];

  const systemPrompt = 'You are an expert English grammar teacher. You extract only text-supported examples for one specific grammar rule.';
  const userPrompt = `Rule to match:
${JSON.stringify({
  id: rule.id,
  title: rule.title,
  summary: rule.summary || '',
})}

Input text blocks (each is a page/chapter fragment):
${JSON.stringify(safeBlocks)}

Task:
- Analyze the blocks and return up to ${count} best excerpts that REALLY match this rule.
- "passage" must be exact text from one block.
- "highlight" must be exact substring from "passage".
- "context_note" must be in Russian and explain precisely why this rule is used in THIS passage.
- Include "block_id" from source block.
- If there are fewer than ${count} reliable examples, return fewer.

Output ONLY valid JSON array:
[{
  "block_id": "B1",
  "passage": "...",
  "highlight": "...",
  "context_note": "..."
}]`;

  const content = await callAI(systemPrompt, userPrompt);
  const cleaned = content.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    parsed = arrayMatch ? JSON.parse(arrayMatch[0]) : [];
  }
  const arr = Array.isArray(parsed) ? parsed : [];
  return arr.map((item) => ({
    block_id: String(item?.block_id || '').trim(),
    passage: String(item?.passage || '').trim(),
    highlight: String(item?.highlight || '').trim(),
    context_note: String(item?.context_note || '').trim(),
  })).filter((item) => item.block_id && item.passage && item.highlight);
}

module.exports = {
  suggestExcerpts,
  suggestSummary,
  annotateSnippetsWithRules,
  annotateSingleSnippetWithRule,
  suggestSnippetsForRuleFromBlocks,
};
