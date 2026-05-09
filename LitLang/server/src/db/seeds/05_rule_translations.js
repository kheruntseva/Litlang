/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('rule_translations').del();
  await knex('rule_translations').insert([
    // Definite article: the
    {
      rule_id: 1,
      locale: 'en',
      title: 'Definite article: the',
      summary: 'The definite article "the" is used before a noun when the speaker believes the listener already knows what is being referred to. It can be used with singular and plural nouns, as well as uncountable nouns. Use "the" when referring to something specific, something previously mentioned, something unique, or with superlatives.',
    },
    {
      rule_id: 1,
      locale: 'ru',
      title: 'Определённый артикль: the',
      summary: 'Определённый артикль "the" используется перед существительным, когда говорящий полагает, что слушатель уже знает, о чём идёт речь. Он может использоваться с исчисляемыми существительными в единственном и множественном числе, а также с неисчисляемыми существительными. Используйте "the", когда речь идёт о чём-то конкретном, ранее упомянутом, уникальном или в превосходной степени.',
    },
    // Indefinite articles: a/an
    {
      rule_id: 2,
      locale: 'en',
      title: 'Indefinite articles: a/an',
      summary: 'The indefinite articles "a" and "an" are used before singular countable nouns when the noun is mentioned for the first time, or when referring to any one of a group. Use "a" before consonant sounds and "an" before vowel sounds. They cannot be used with plural or uncountable nouns.',
    },
    {
      rule_id: 2,
      locale: 'ru',
      title: 'Неопределённые артикли: a/an',
      summary: 'Неопределённые артикли "a" и "an" используются перед исчисляемыми существительными в единственном числе, когда предмет упоминается впервые или речь идёт о любом из группы. "A" ставится перед согласными звуками, "an" — перед гласными. Они не используются с существительными во множественном числе или неисчисляемыми.',
    },
    // Zero article
    {
      rule_id: 3,
      locale: 'en',
      title: 'Zero article',
      summary: 'The zero article (no article) is used with plural countable nouns and uncountable nouns when speaking in general terms. It is also used with proper nouns (names), languages, meals, sports, and academic subjects. Understanding when to omit the article is essential for natural-sounding English.',
    },
    {
      rule_id: 3,
      locale: 'ru',
      title: 'Нулевой артикль',
      summary: 'Нулевой артикль (отсутствие артикля) используется с исчисляемыми существительными во множественном числе и неисчисляемыми существительными при обобщении. Также используется с именами собственными, названиями языков, приёмами пищи, видами спорта и учебными предметами.',
    },
  ]);
};
