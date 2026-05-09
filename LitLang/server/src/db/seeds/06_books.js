/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('books').del();
  await knex('books').insert([
    {
      id: 1,
      title: '1984',
      author: 'George Orwell',
      isbn: '9780451524935',
      language_id: 1,
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg',
    },
    {
      id: 2,
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      isbn: '9780141439518',
      language_id: 1,
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg',
      gutenberg_id: 1342,
    },
    {
      id: 3,
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      isbn: '9780743273565',
      language_id: 1,
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
    },
    {
      id: 4,
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      isbn: '9780061120084',
      language_id: 1,
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg',
    },
    {
      id: 5,
      title: 'Jane Eyre',
      author: 'Charlotte Bront\u00eb',
      isbn: '9780141441146',
      language_id: 1,
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780141441146-L.jpg',
      gutenberg_id: 1260,
    },
  ]);
  await knex.raw("SELECT setval('books_id_seq', (SELECT MAX(id) FROM books))");
};
