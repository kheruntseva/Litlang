const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Call OpenRouter API for chat completions.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>}
 */
async function callAI(systemPrompt, userPrompt) {
  const apiKey = config.ai.openRouterApiKey;
  const configuredModel = (config.ai.openRouterModel || 'nvidia/nemotron-3-super-120b-a12b:free')
    .trim()
    .replace(/,+$/, '');
  const fallbackModels = ['openai/gpt-oss-20b:free', 'nvidia/nemotron-3-super-120b-a12b:free'];
  const modelsToTry = [configuredModel, ...fallbackModels].filter((model, idx, arr) => model && arr.indexOf(model) === idx);
  if (!apiKey) {
    throw new AppError('AI API key not configured. Set OPENROUTER_API_KEY in .env', 503, 'AI_NOT_CONFIGURED');
  }

  for (const model of modelsToTry) {
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 1200,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      return response.data.choices[0].message.content;
    } catch (err) {
      logger.error(
        {
          err: err.message,
          model,
          status: err.response?.status,
          response: err.response?.data,
        },
        'AI API call failed'
      );
      const status = err.response?.status;
      // Try the next model for "model not found", gateway timeouts, and upstream failures.
      if (![404, 408, 429, 500, 502, 503, 504].includes(status)) break;
    }
  }

  throw new AppError('AI service unavailable', 503, 'AI_ERROR');
}

/**
 * Suggest literary excerpts for a grammar rule.
 * @param {object} rule - { title, summary }
 * @param {number} count - Number of suggestions
 * @returns {Promise<Array>}
 */
async function suggestExcerpts(rule, count = 5) {
  const systemPrompt = 'You are a language learning content creator specializing in grammar instruction through literature.';
  const userPrompt = `For the grammar rule "${rule.title}" (${rule.summary}), provide ${count} short excerpts (1-3 sentences each) from well-known published novels that clearly demonstrate ONLY this rule.
Important:
- "highlight" MUST be the exact substring from "passage" that demonstrates the rule.
- Do not output examples where the highlighted phrase is ambiguous for this rule.
- Use clean plain text passages (no markdown).
For each excerpt, return JSON:
[{ "passage": "...", "highlight": "the specific words demonstrating the rule", "book_title": "...", "author": "...", "page_hint": "approximate page or chapter", "context_note": "why this excerpt demonstrates the rule" }]
Return ONLY valid JSON array, no markdown, no explanation.`;

  const content = await callAI(systemPrompt, userPrompt);

  try {
    // Strip markdown fences and extract first JSON array if model adds extra text.
    const cleaned = content.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    const directParsed = JSON.parse(cleaned);
    const parsed = Array.isArray(directParsed)
      ? directParsed
      : (Array.isArray(directParsed?.data) ? directParsed.data : null);
    if (!parsed) throw new Error('Invalid AI JSON shape');
    return parsed.map((item) => ({
      passage: String(item?.passage || '').trim(),
      highlight: String(item?.highlight || '').trim(),
      book_title: String(item?.book_title || '').trim(),
      author: String(item?.author || '').trim(),
      page_hint: item?.page_hint ? String(item.page_hint).trim() : null,
      context_note: item?.context_note ? String(item.context_note).trim() : null,
    })).filter((item) => item.passage);
  } catch {
    try {
      const cleaned = content.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!arrayMatch) throw new Error('No array found');
      const parsed = JSON.parse(arrayMatch[0]);
      if (!Array.isArray(parsed)) throw new Error('Extracted value is not array');
      return parsed.map((item) => ({
        passage: String(item?.passage || '').trim(),
        highlight: String(item?.highlight || '').trim(),
        book_title: String(item?.book_title || '').trim(),
        author: String(item?.author || '').trim(),
        page_hint: item?.page_hint ? String(item.page_hint).trim() : null,
        context_note: item?.context_note ? String(item.context_note).trim() : null,
      })).filter((item) => item.passage);
    } catch {
      logger.warn({ content }, 'Failed to parse AI excerpt suggestions');
      throw new AppError('Failed to parse AI response', 502, 'AI_PARSE_ERROR');
    }
  }
}

/**
 * Suggest a grammar summary for a rule.
 * @param {object} rule - { title }
 * @returns {Promise<string>}
 */
async function suggestSummary(rule) {
  const systemPrompt = 'You are a language learning content creator. Write clear, concise grammar explanations for intermediate learners.';
  const userPrompt = `Write a concise grammar explanation (2-4 paragraphs) for the rule: "${rule.title}".
Include when to use it, common patterns, and typical mistakes.
Make it suitable for intermediate learners studying English.
Return ONLY the explanation text, no markdown headers or formatting.`;

  return callAI(systemPrompt, userPrompt);
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
