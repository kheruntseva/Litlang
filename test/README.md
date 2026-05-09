# LitLang Testing

## 1) Functional tests (automated API checks)

1. Copy `.env.example` to `.env`
2. Fill credentials and base URL
3. Install deps:

```bash
npm install
```

4. Run:

```bash
npm run test:functional
```

Result report will be saved to `functional-report.json`.

## 2) Load testing (k6)

Run k6 using environment variables:

```bash
k6 run load-test.k6.js -e BASE_URL=https://localhost/api/v1 -e USER_EMAIL=georg@litlang.com -e USER_PASSWORD=123456
```

Default profile:
- 25 virtual users
- 15 minutes duration
- success/error and latency thresholds configured in script
