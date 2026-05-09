/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('excerpts').del();
  await knex('excerpts').insert([
    // Rule 1: Definite article "the"
    {
      rule_id: 1,
      book_id: 1,
      passage: 'It was a bright cold day in April, and the clocks were striking thirteen.',
      highlight: 'the clocks',
      page_number: '1',
      chapter: 'Part One, Chapter 1',
      context_note: 'The definite article "the" refers to specific clocks known in the setting.',
      sort_order: 1,
    },
    {
      rule_id: 1,
      book_id: 2,
      passage: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      highlight: 'a good fortune',
      page_number: '1',
      chapter: 'Chapter 1',
      context_note: 'Notice the contrast between "a truth" (indefinite, general) and specific references later.',
      sort_order: 2,
    },
    {
      rule_id: 1,
      book_id: 3,
      passage: 'So we beat on, boats against the current, borne back ceaselessly into the past.',
      highlight: 'the current',
      page_number: '180',
      chapter: 'Chapter 9',
      context_note: '"The current" uses the definite article to refer to the specific, singular current of life and time.',
      sort_order: 3,
    },
    // Rule 2: Indefinite articles "a/an"
    {
      rule_id: 2,
      book_id: 4,
      passage: 'Until I feared I would lose it, I never loved to read. One does not love breathing.',
      highlight: 'One does not love breathing',
      page_number: '20',
      chapter: 'Chapter 2',
      context_note: 'Here the zero article with "breathing" as a general concept contrasts with earlier indefinite usage.',
      sort_order: 1,
    },
    {
      rule_id: 2,
      book_id: 5,
      passage: 'I am no bird; and no net ensnares me: I am a free human being with an independent will.',
      highlight: 'a free human being',
      page_number: '284',
      chapter: 'Chapter 23',
      context_note: '"A free human being" uses the indefinite article to describe one of a kind — any free human being.',
      sort_order: 2,
    },
    {
      rule_id: 2,
      book_id: 1,
      passage: 'He was a lonely ghost uttering a truth that nobody would ever hear.',
      highlight: 'a lonely ghost',
      page_number: '30',
      chapter: 'Part One, Chapter 2',
      context_note: '"A lonely ghost" introduces the character comparison for the first time, hence the indefinite article.',
      sort_order: 3,
    },
    // Rule 3: Zero article
    {
      rule_id: 3,
      book_id: 2,
      passage: 'Vanity and pride are different things, though the words are often used synonymously.',
      highlight: 'Vanity and pride',
      page_number: '15',
      chapter: 'Chapter 5',
      context_note: 'Abstract concepts "vanity" and "pride" take no article when discussed in general terms.',
      sort_order: 1,
    },
    {
      rule_id: 3,
      book_id: 3,
      passage: 'In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since.',
      highlight: 'some advice',
      page_number: '1',
      chapter: 'Chapter 1',
      context_note: '"Advice" is uncountable and takes no definite or indefinite article; "some" is used as a quantifier.',
      sort_order: 2,
    },
  ]);
};
