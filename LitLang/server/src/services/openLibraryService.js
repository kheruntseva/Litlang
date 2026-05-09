const axios = require('axios');
const config = require('../config');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Lookup book metadata by ISBN from Open Library.
 * @param {string} isbn
 * @returns {Promise<object>} - { title, author, cover_url, publish_date }
 */
async function lookupByIsbn(isbn) {
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  const request = async (url) => {
    try {
      return await axios.get(url, { timeout: 10000 });
    } catch (err) {
      if (err.code === 'ECONNABORTED' || !err.response) {
        // One retry for transient network slowness.
        return axios.get(url, { timeout: 20000 });
      }
      throw err;
    }
  };

  try {
    const url = `${config.openLibrary.baseUrl}/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
    const response = await request(url);

    const key = `ISBN:${cleanIsbn}`;
    const data = response.data[key];

    if (data) {
      return {
        title: data.title || '',
        author: data.authors?.map((a) => a.name).join(', ') || '',
        cover_url: data.cover?.large || data.cover?.medium || null,
        publish_date: data.publish_date || null,
        isbn: cleanIsbn,
      };
    }

    // Fallback: some editions are absent in /api/books but present in search index.
    const searchUrl = `${config.openLibrary.baseUrl}/search.json?isbn=${encodeURIComponent(cleanIsbn)}&limit=1`;
    const searchRes = await request(searchUrl);
    const doc = searchRes.data?.docs?.[0];
    if (!doc) {
      throw new AppError('Book not found in Open Library', 404, 'BOOK_NOT_FOUND');
    }

    return {
      title: doc.title || '',
      author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : '',
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      publish_date: Array.isArray(doc.publish_date) ? doc.publish_date[0] : null,
      isbn: cleanIsbn,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err: err.message }, 'Open Library lookup failed');
    throw new AppError('Open Library service unavailable', 502, 'OPEN_LIBRARY_ERROR');
  }
}

module.exports = { lookupByIsbn };
