const axios = require('axios');
const db = require('../db/connection');
const aiService = require('./aiService');
const logger = require('../utils/logger');
const { AppError, NotFoundError } = require('../utils/errors');

const GUTENDEX_URL = 'https://gutendex.com/books';
const GUTENBERG_TEXT_URL = 'https://www.gutenberg.org/files';
const GUTENBERG_CACHE_URL = 'https://www.gutenberg.org/cache/epub';

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSnippetContextNote(passage) {
  const text = String(passage || '').trim();
  const lower = text.toLowerCase();

  if (/\bused to\b/.test(lower)) {
    return 'В этом отрывке конструкция "used to" показывает регулярное действие или состояние в прошлом, которое сейчас уже не актуально.';
  }
  if (/\b(had been|had\s+\w+ed)\b/.test(lower)) {
    return 'Здесь видна форма Past Perfect: действие завершилось до другого момента в прошлом, поэтому используется предшествование во времени.';
  }
  if (/\b(has|have)\s+been\b/.test(lower)) {
    return 'В этом предложении используется Present Perfect (Continuous), чтобы связать прошлое действие с текущим моментом и подчеркнуть результат/длительность.';
  }
  if (/\b(was|were)\s+\w+ed\b/.test(lower) || /\b(is|are)\s+\w+ed\b/.test(lower)) {
    return 'В этом отрывке используется пассивная конструкция: фокус смещен с исполнителя действия на объект или результат.';
  }
  if (/\bif\b/.test(lower) && /\bwould\b/.test(lower)) {
    return 'Это условная структура: сочетание "if" и "would" показывает зависимость результата от условия.';
  }
  if (/\b(will|shall)\b/.test(lower)) {
    return 'В предложении есть маркер будущего времени, поэтому конструкция выражает намерение, прогноз или запланированное действие.';
  }
  if (/\b(never|already|just|yet)\b/.test(lower)) {
    return 'Здесь используются временные маркеры (already/just/yet/never), которые уточняют момент и завершенность действия в контексте правила.';
  }

  return 'Этот отрывок показывает грамматическую конструкцию в естественном контексте: форму и порядок слов удобно разбирать прямо по тексту предложения.';
}

function annotateSnippetsHeuristically(snippets, rules) {
  const safeSnippets = Array.isArray(snippets) ? snippets : [];
  const safeRules = Array.isArray(rules) ? rules : [];
  if (safeSnippets.length === 0 || safeRules.length === 0) return safeSnippets;

  const normalizedRules = safeRules.map((rule) => {
    const title = String(rule.title || '').trim();
    const summary = String(rule.summary || '').trim();
    const tokenSource = `${title} ${summary}`.toLowerCase();
    const tokens = tokenSource
      .replace(/[^a-zа-я0-9\s-]/gi, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
    return { ...rule, title, summary, tokens };
  });

  return safeSnippets.map((snippet) => {
    const passage = String(snippet.passage || '');
    const lower = passage.toLowerCase();
    let bestRule = null;
    let bestToken = '';
    let bestScore = -1;

    normalizedRules.forEach((rule) => {
      let score = 0;
      let matchedToken = '';
      rule.tokens.forEach((token) => {
        if (lower.includes(token.toLowerCase())) {
          score += token.length;
          if (!matchedToken || token.length > matchedToken.length) matchedToken = token;
        }
      });
      if (score > bestScore) {
        bestScore = score;
        bestRule = rule;
        bestToken = matchedToken;
      }
    });

    if (!bestRule) return snippet;

    const highlight = snippet.highlight || (bestToken && passage.match(new RegExp(escapeRegex(bestToken), 'i'))?.[0]) || null;
    const context = highlight
      ? `В этом предложении фрагмент "${highlight}" показывает использование правила "${bestRule.title}" в конкретном контексте.`
      : `Этот отрывок соответствует правилу "${bestRule.title}" по грамматической конструкции в предложении.`;

    return {
      ...snippet,
      rule_id: Number(bestRule.id),
      rule_title: bestRule.title,
      rule_summary: bestRule.summary || null,
      highlight,
      context_note: context,
    };
  });
}

function isAnnotationValid(item, ruleMap) {
  if (!item || !item.passage) return false;
  const rule = ruleMap.get(Number(item.rule_id));
  if (!rule) return false;
  const highlight = String(item.highlight || '').trim();
  if (!highlight) return false;
  const passageLower = String(item.passage || '').toLowerCase();
  if (!passageLower.includes(highlight.toLowerCase())) return false;
  const note = String(item.context_note || '').toLowerCase();
  if (!note || note.length < 20) return false;
  if (note.includes('контекстном контексте')) return false;
  return true;
}

/**
 * Search Gutenberg catalog via Gutendex API.
 * @param {string} query - Search term
 * @returns {Promise<Array>}
 */
async function search(query) {
  const request = async () => axios.get(GUTENDEX_URL, {
    params: { search: query },
    timeout: 8000,
  });
  try {
    const response = await request();
    return response.data.results.map((book) => ({
      gutenberg_id: book.id,
      title: book.title,
      authors: book.authors.map((a) => a.name),
      languages: book.languages,
      formats: Object.keys(book.formats),
    }));
  } catch (err) {
    logger.error({ err: err.message }, 'Gutenberg search failed; fallback to local imported books');
    const q = String(query || '').trim();
    if (!q) return [];
    const local = await db('books')
      .whereNotNull('gutenberg_id')
      .andWhere((qb) => {
        qb.where('title', 'ilike', `%${q}%`)
          .orWhere('author', 'ilike', `%${q}%`);
      })
      .select('gutenberg_id', 'title', 'author')
      .orderBy('title')
      .limit(50);
    return local.map((book) => ({
      gutenberg_id: book.gutenberg_id,
      title: book.title,
      authors: book.author ? [book.author] : [],
      languages: [],
      formats: [],
      imported: true,
      source: 'local_fallback',
    }));
  }
}

/**
 * Import a Gutenberg text by ID.
 * Downloads the full text, strips header/footer, stores in gutenberg_texts table.
 * @param {number} gutenbergId
 * @returns {Promise<object>} - The created book record
 */
async function importText(gutenbergId, fallbackMeta = {}) {
  // Fetch book metadata from Gutendex (best effort).
  // Even if metadata API is unavailable, we still try to import text by ID.
  let bookMeta = null;
  try {
    const metaRes = await axios.get(`${GUTENDEX_URL}/${gutenbergId}`, { timeout: 8000 });
    bookMeta = metaRes.data;
  } catch (err) {
    logger.warn({ err: err.message, gutenbergId }, 'Failed to fetch Gutendex metadata, continuing with text import fallback');
  }

  // Try to download the plain text
  let fullText;
  const urls = [
    `${GUTENBERG_TEXT_URL}/${gutenbergId}/${gutenbergId}-0.txt`,
    `${GUTENBERG_CACHE_URL}/${gutenbergId}/pg${gutenbergId}.txt`,
  ];

  for (const url of urls) {
    try {
      const textRes = await axios.get(url, { timeout: 30000, responseType: 'text' });
      fullText = textRes.data;
      break;
    } catch {
      continue;
    }
  }

  if (!fullText) {
    throw new AppError('Could not download Gutenberg text', 502, 'GUTENBERG_DOWNLOAD_ERROR');
  }

  // Strip header and footer
  const startMarker = '*** START OF THE PROJECT GUTENBERG EBOOK';
  const endMarker = '*** END OF THE PROJECT GUTENBERG EBOOK';
  const startIdx = fullText.indexOf(startMarker);
  const endIdx = fullText.indexOf(endMarker);

  if (startIdx !== -1) {
    const afterStart = fullText.indexOf('\n', startIdx) + 1;
    fullText = fullText.substring(afterStart, endIdx !== -1 ? endIdx : undefined).trim();
  }

  // Create book record and store text
  const title = bookMeta?.title || fallbackMeta?.title || `Gutenberg #${gutenbergId}`;
  const authorName = bookMeta?.authors?.map((a) => a.name).join(', ')
    || fallbackMeta?.author
    || 'Unknown';
  const language = bookMeta?.languages?.[0] || fallbackMeta?.language || 'en';

  const result = await db.transaction(async (trx) => {
    // Find or create language
    let lang = await trx('languages').where('code', language).first();
    if (!lang) {
      [lang] = await trx('languages').insert({ code: language, name: language }).returning('*');
    }

    // Create book
    const [book] = await trx('books')
      .insert({
        title,
        author: authorName,
        language_id: lang.id,
        gutenberg_id: gutenbergId,
      })
      .onConflict('gutenberg_id')
      .merge({ title, author: authorName })
      .returning('*');

    // Store full text. We upsert manually because some databases were created
    // without a unique constraint on book_id.
    const existingText = await trx('gutenberg_texts')
      .where({ book_id: book.id })
      .first();
    if (existingText) {
      await trx('gutenberg_texts')
        .where({ book_id: book.id })
        .update({ full_text: fullText });
    } else {
      await trx('gutenberg_texts')
        .insert({ book_id: book.id, full_text: fullText });
    }

    return book;
  });

  return result;
}

/**
 * Extract sentences matching a pattern from stored Gutenberg text.
 * @param {number} bookId
 * @param {number} ruleId - For context
 * @param {string} pattern - Regex pattern to match
 * @param {number} maxResults - Maximum results to return
 * @returns {Promise<Array>}
 */
async function extractPassages(bookId, ruleId, pattern, maxResults = 10) {
  const record = await db('gutenberg_texts').where('book_id', bookId).first();
  if (!record) {
    throw new NotFoundError('Gutenberg text for this book');
  }

  // Split into sentences (simple approach)
  const sentences = record.full_text
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 20);

  let regex;
  try {
    regex = new RegExp(pattern, 'gi');
  } catch {
    throw new AppError('Invalid regex pattern', 400, 'INVALID_PATTERN');
  }

  const matches = [];
  for (let i = 0; i < sentences.length && matches.length < maxResults; i++) {
    const sentence = sentences[i].trim();
    if (regex.test(sentence)) {
      regex.lastIndex = 0; // Reset for next test
      const match = sentence.match(regex);
      matches.push({
        passage: sentence,
        highlight: match ? match[0] : null,
        paragraph_number: i + 1,
      });
    }
  }

  return matches;
}

/**
 * List raw Gutenberg snippets for a book, excluding passages already in catalog excerpts.
 * @param {number} bookId
 * @param {object} options
 * @param {number} options.page
 * @param {number} options.limit
 * @returns {Promise<{data:Array,meta:object}>}
 */
async function listBookSnippets(bookId, { page = 1, limit = 5 } = {}) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(20, Math.max(1, parseInt(limit, 10) || 5));

  const [book, initialRecord] = await Promise.all([
    db('books').where({ id: bookId }).first(),
    db('gutenberg_texts').where('book_id', bookId).first(),
  ]);
  if (!book) throw new NotFoundError('Book');

  let record = initialRecord;
  if (!record && book.gutenberg_id) {
    await importText(book.gutenberg_id, {
      title: book.title,
      author: book.author,
    });
    record = await db('gutenberg_texts').where('book_id', bookId).first();
  }
  if (!record) throw new NotFoundError('Gutenberg text for this book');

  const existing = await db('excerpts').where({ book_id: bookId }).select('passage');
  const existingSet = new Set(existing.map((e) => (e.passage || '').trim()));

  const sentences = record.full_text
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35 && !existingSet.has(s))
    .map((passage, i) => ({
      id: i + 1,
      passage,
      paragraph_number: i + 1,
      page_number: `¶${i + 1}`,
      chapter: `Chapter ${Math.floor(i / 120) + 1}`,
      book_id: book.id,
      book_title: book.title,
      book_author: book.author,
      context_note: buildSnippetContextNote(passage),
    }));

  const total = sentences.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = sentences.slice(offset, offset + limit);

  return {
    data,
    meta: { page, limit, total, totalPages },
  };
}

/**
 * List Gutenberg snippets for a specific grammar rule with highlight and metadata.
 * @param {number} bookId
 * @param {number} ruleId
 * @param {string|undefined} pattern
 * @param {object} options
 * @param {number} options.page
 * @param {number} options.limit
 * @param {string} options.locale
 * @returns {Promise<{data:Array,meta:object}>}
 */
async function listBookSnippetsForRule(bookId, ruleId, pattern, { page = 1, limit = 5, locale = 'en' } = {}) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(20, Math.max(1, parseInt(limit, 10) || 5));

  const [book, initialRecord, rule, translation, enTranslation] = await Promise.all([
    db('books').where({ id: bookId }).first(),
    db('gutenberg_texts').where('book_id', bookId).first(),
    db('rules').where({ id: ruleId }).first(),
    db('rule_translations').where({ rule_id: ruleId, locale }).first(),
    db('rule_translations').where({ rule_id: ruleId, locale: 'en' }).first(),
  ]);
  if (!book) throw new NotFoundError('Book');
  if (!rule) throw new NotFoundError('Rule');

  let record = initialRecord;
  if (!record && book.gutenberg_id) {
    await importText(book.gutenberg_id, {
      title: book.title,
      author: book.author,
    });
    record = await db('gutenberg_texts').where('book_id', bookId).first();
  }
  if (!record) throw new NotFoundError('Gutenberg text for this book');

  const existing = await db('excerpts').where({ book_id: bookId }).select('passage');
  const existingSet = new Set(existing.map((e) => (e.passage || '').trim()));

  const sentences = record.full_text
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35 && !existingSet.has(s));

  const paragraphs = record.full_text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);
  const blockSize = 16;
  const blocks = [];
  for (let i = 0; i < paragraphs.length; i += blockSize) {
    const part = paragraphs.slice(i, i + blockSize);
    blocks.push({
      block_id: `B${Math.floor(i / blockSize) + 1}`,
      page_number: `¶${i + 1}`,
      chapter: `Chapter ${Math.floor(i / 120) + 1}`,
      text: part.join('\n\n').slice(0, 2500),
    });
    if (blocks.length >= 14) break;
  }

  let matched = [];
  try {
    const aiItems = await Promise.race([
      aiService.suggestSnippetsForRuleFromBlocks({
        rule: {
          id: rule.id,
          title: translation?.title || enTranslation?.title || rule.slug,
          summary: translation?.summary || enTranslation?.summary || '',
        },
        blocks,
        count: Math.max(6, limit * 2),
      }),
      new Promise((resolve) => setTimeout(() => resolve([]), 14000)),
    ]);

    const blockMap = new Map(blocks.map((b) => [b.block_id, b]));
    matched = aiItems
      .map((item, idx) => {
        const block = blockMap.get(item.block_id);
        if (!block) return null;
        const passage = String(item.passage || '').trim();
        const highlight = String(item.highlight || '').trim();
        if (!passage || !highlight) return null;
        if (!block.text.toLowerCase().includes(passage.toLowerCase())) return null;
        if (!passage.toLowerCase().includes(highlight.toLowerCase())) return null;
        if (existingSet.has(passage)) return null;
        return {
          id: idx + 1,
          passage,
          highlight,
          paragraph_number: idx + 1,
          page_number: block.page_number,
          chapter: block.chapter,
          book_id: book.id,
          book_title: book.title,
          book_author: book.author,
          rule_id: rule.id,
          rule_slug: rule.slug,
          rule_title: translation?.title || rule.slug,
          rule_summary: translation?.summary || '',
          context_note: item.context_note,
        };
      })
      .filter(Boolean);
  } catch (err) {
    logger.warn({ err: err.message, bookId, ruleId }, 'AI rule-based snippet extraction failed');
  }

  // Fallback to regex only if AI produced nothing.
  if (matched.length === 0) {
    let regex;
    if (pattern && String(pattern).trim()) {
      regex = new RegExp(String(pattern).trim(), 'gi');
    } else {
      const tokenSource = `${translation?.title || ''} ${translation?.summary || ''} ${enTranslation?.title || ''} ${enTranslation?.summary || ''} ${rule.slug || ''}`.toLowerCase();
      const tokens = tokenSource.replace(/[^a-zа-я0-9\s-]/gi, ' ').split(/\s+/).filter((t) => t.trim().length >= 4);
      const token = tokens[0] || String(rule.slug || '').split('-')[0] || 'the';
      regex = new RegExp(`\\b${escapeRegex(token)}\\b`, 'gi');
    }
    matched = [];
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const found = sentence.match(regex);
      regex.lastIndex = 0;
      if (!found) continue;
      matched.push({
        id: i + 1,
        passage: sentence,
        highlight: found[0],
        paragraph_number: i + 1,
        page_number: `¶${i + 1}`,
        chapter: `Chapter ${Math.floor(i / 120) + 1}`,
        book_id: book.id,
        book_title: book.title,
        book_author: book.author,
        rule_id: rule.id,
        rule_slug: rule.slug,
        rule_title: translation?.title || rule.slug,
        rule_summary: translation?.summary || '',
        context_note: `Фрагмент "${found[0]}" в этом предложении используется как маркер правила "${translation?.title || rule.slug}".`,
      });
      if (matched.length >= Math.max(6, limit * 2)) break;
    }
  }

  const total = matched.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = matched.slice(offset, offset + limit);
  return { data, meta: { page, limit, total, totalPages } };
}

module.exports = { search, importText, extractPassages, listBookSnippets, listBookSnippetsForRule };
