## Реальный backend + внешняя БД (чтобы потом менять хостинг, а БД не трогать)

### Идея (по‑простому)
1) База данных живёт **отдельно** (например Neon Postgres).
2) Backend (API) можно переносить куда угодно, потому что он подключается к БД по строке `DATABASE_URL`.
3) Frontend можно переносить вместе с backend (лучше), или отдельно (сложнее из‑за cookies).

### Рекомендуемый вариант для MVP
**Один сервис** (backend), который:
- отдаёт сайт (frontend)
- обслуживает API

Так проще с безопасной авторизацией (cookie/refresh) и не нужно мучиться с CORS.

### Шаг 1 — создать бесплатную Postgres БД (Neon)
1) Зарегистрируйтесь в Neon
2) Создайте проект (database)
3) Скопируйте connection string вида:
`postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require`

Это и будет ваш “якорь”: БД остаётся там, вы меняете только хостинг сайта/API.

### Шаг 2 — локально подключить API к этой БД (проверка)
1) Переместите проект из Google Drive в обычную папку (важно):
- например `C:\\Projects\\LK_4_B24`
2) В `apps/api/env.local` задайте:
- `DATABASE_URL=...` (строка Neon)
3) Установите зависимости для API:
```bash
npm install -w @lk/shared -w @lk/api --include-workspace-root=false --no-audit --no-fund
```
4) Миграция (Postgres):
```bash
npm run db:migrate:pg:dev -w @lk/api
```
5) Запуск API:
```bash
npm run dev:api
```

### Шаг 3 — деплой (Render)
Схема:
- Render Web Service запускает `@lk/api`
- Frontend отдаётся тем же сервисом (у нас уже есть это поведение в production)

Build command:
```bash
npm install && npm run build -w @lk/web && npm run build -w @lk/api
```

Start command:
```bash
npm run start -w @lk/api
```

Environment variables (Render):
- `NODE_ENV=production`
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=strict`
- `JWT_ACCESS_SECRET=...` (30+ символов)
- `JWT_REFRESH_SECRET=...` (30+ символов)
- `DATABASE_URL=...` (Neon)
- Bitrix (когда будете готовы): `BITRIX_MODE=real`, `BITRIX_BASE_URL`, `BITRIX_WEBHOOK_PATH`, и поля

### Что будет “миграцией”
Если вы захотите перенести сайт/API на другой хостинг:
- вы просто деплоите этот же код в другом месте
- прописываете тот же `DATABASE_URL`
- данные остаются в Neon (без переноса)


