import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://localhost/api/v1';
const USER_EMAIL = process.env.USER_EMAIL;
const USER_PASSWORD = process.env.USER_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const httpsAgent = new (await import('https')).Agent({ rejectUnauthorized: false });

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  httpsAgent,
});

function asErrorMessage(err) {
  if (err?.response?.data?.error?.message) return err.response.data.error.message;
  if (err?.response?.status) return `HTTP ${err.response.status}`;
  return err.message || 'Unknown error';
}

async function testStep(id, name, run) {
  const startedAt = Date.now();
  try {
    const details = await run();
    return {
      id,
      name,
      ok: true,
      status: details?.status || 200,
      ms: Date.now() - startedAt,
      details: details?.details || 'OK',
    };
  } catch (err) {
    return {
      id,
      name,
      ok: false,
      status: err?.response?.status || 0,
      ms: Date.now() - startedAt,
      details: asErrorMessage(err),
    };
  }
}

async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  const token = data?.data?.accessToken;
  if (!token) throw new Error('No accessToken in login response');
  return token;
}

async function run() {
  if (!USER_EMAIL || !USER_PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Fill .env first (see .env.example)');
  }

  const results = [];
  let userToken = '';
  let adminToken = '';

  results.push(await testStep(1, 'Авторизация пользователя', async () => {
    userToken = await login(USER_EMAIL, USER_PASSWORD);
    return { status: 200, details: 'Получен accessToken пользователя' };
  }));

  results.push(await testStep(2, 'Авторизация администратора', async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    return { status: 200, details: 'Получен accessToken администратора' };
  }));

  results.push(await testStep(3, 'Получение профиля /me', async () => {
    const { status } = await api.get('/me', { headers: { Authorization: `Bearer ${userToken}` } });
    return { status, details: 'Профиль пользователя получен' };
  }));

  results.push(await testStep(4, 'Получение языков', async () => {
    const { status } = await api.get('/languages');
    return { status, details: 'Список языков получен' };
  }));

  results.push(await testStep(5, 'Поиск Gutenberg книг', async () => {
    const { status } = await api.get('/me/gutenberg/search', {
      params: { q: 'Jane Eyre' },
      headers: { Authorization: `Bearer ${userToken}` },
    });
    return { status, details: 'Поиск Gutenberg выполнен' };
  }));

  results.push(await testStep(6, 'Получение избранного', async () => {
    const { status } = await api.get('/me/favourites', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    return { status, details: 'Избранное загружено' };
  }));

  results.push(await testStep(7, 'Получение статистики прогресса', async () => {
    const { status } = await api.get('/me/stats', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    return { status, details: 'Статистика пользователя получена' };
  }));

  results.push(await testStep(8, 'Список импортированных Gutenberg книг (admin)', async () => {
    const { status } = await api.get('/admin/gutenberg/imported-books', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    return { status, details: 'Импортированные книги загружены' };
  }));

  results.push(await testStep(9, 'Поиск Gutenberg книг (admin)', async () => {
    const { status } = await api.get('/admin/gutenberg/search', {
      params: { q: 'Agatha Christie' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    return { status, details: 'Админ-поиск Gutenberg выполнен' };
  }));

  results.push(await testStep(10, 'Получение dashboard аналитики (admin)', async () => {
    const { status } = await api.get('/admin/analytics/dashboard', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    return { status, details: 'Аналитика загружена' };
  }));

  const passed = results.filter((x) => x.ok).length;
  const failed = results.length - passed;

  console.table(results.map((r) => ({
    '№': r.id,
    'Тест': r.name,
    'Код': r.status,
    'Время, мс': r.ms,
    'Результат': r.ok ? 'Успешно' : 'Ошибка',
    'Детали': r.details,
  })));

  const report = {
    date: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: { total: results.length, passed, failed },
    results,
  };

  await fs.writeFile('./functional-report.json', JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\nSaved report: functional-report.json`);
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
