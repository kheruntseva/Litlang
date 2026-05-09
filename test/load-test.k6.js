import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 25,
  duration: '15m',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://localhost/api/v1';
const EMAIL = __ENV.USER_EMAIL || 'georg@litlang.com';
const PASSWORD = __ENV.USER_PASSWORD || '123456';

export function setup() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, { 'login status 200': (r) => r.status === 200 });
  const body = JSON.parse(res.body || '{}');
  const token = body?.data?.accessToken;
  return { token };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
  };

  const r1 = http.get(`${BASE_URL}/me`, { headers });
  check(r1, { 'GET /me 200': (r) => r.status === 200 });

  const r2 = http.get(`${BASE_URL}/me/favourites`, { headers });
  check(r2, { 'GET /me/favourites 200': (r) => r.status === 200 });

  const r3 = http.get(`${BASE_URL}/me/gutenberg/search?q=Jane`, { headers });
  check(r3, { 'GET /me/gutenberg/search 200': (r) => r.status === 200 });

  sleep(1);
}
