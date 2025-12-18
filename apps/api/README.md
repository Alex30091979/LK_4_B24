## @lk/api — Backend API

### Запуск (dev)
1) Переменные окружения:
- Если можно: создайте `apps/api/.env` по шаблону `config/env.example`
- Если нельзя: создайте `apps/api/env.local` по шаблону `apps/api/env.local.example`

2) Установите зависимости в корне:
```bash
npm install
```

3) Миграция и seed:
```bash
npm run db:migrate -w @lk/api
npm run db:seed -w @lk/api
```

4) Запуск API:
```bash
npm run dev:api
```

Swagger UI: `http://localhost:8080/docs`

### Важные принципы безопасности (реализовано)
- **refresh-token** хранится только в **HttpOnly cookie** (`/auth` path), с **rotation** и проверкой `jti`.
- **access-token** выдаётся в JSON для API-first клиентов.
- **CSRF**: для `/auth/refresh` и `/auth/logout` требуется заголовок `x-csrf-token` = cookie `csrfToken`.
- **Rate limiting + lockout** по идентификатору (`email:...`, `phone:...`) и общий rate-limit по IP.
- **2FA**: admin требует TOTP (MFA verified) для `/admin/*`.
- **Audit log**: вход/ошибки/блокировки/раскрытие дерева/синхронизация.

### Основные эндпоинты
#### Auth
- `GET /auth/csrf` → `{ csrfToken }`
- `POST /auth/login/password`
- `POST /auth/login/sms/request`
- `POST /auth/login/sms/verify`
- `POST /auth/refresh` (CSRF)
- `POST /auth/logout` (CSRF)
- `POST /auth/mfa/setup` (admin)
- `POST /auth/mfa/verify` (admin)

#### Client (и admin тоже может)
- `GET /me`
- `GET /me/summary`
- `GET /me/recommendations?depth=1&page=1&pageSize=20&sort=contractDate&order=desc`
- `GET /me/contracts/:id`

#### Admin (только при MFA)
- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/:id/allowed-depth`
- `GET /admin/recommendations/flat?rootBitrixId=...&depth=...`
- `GET /admin/recommendations/children?referrerBitrixId=...` (lazy tree)
- `GET /admin/audit`
- `POST /admin/sync/bitrix` (в demo вернёт Not implemented для BITRIX_MODE=real)

### Примеры ответов
#### `POST /auth/login/password`
Успешно (client):
```json
{ "accessToken": "eyJ..." }
```
Admin (нужно 2FA):
```json
{ "mfaRequired": true }
```
Admin (нужно настроить 2FA):
```json
{ "mfaSetupRequired": true }
```

#### `GET /me/recommendations?...`
```json
{
  "items": [
    {
      "referredBitrixContactId": "2001",
      "fullName": "Рекомендация 1",
      "contractId": "ck....",
      "contractDate": "2025-01-10T00:00:00.000Z",
      "reward": { "currency": "RUB", "amount": 15000 },
      "status": "active",
      "depth": 1,
      "path": ["2000","2001"]
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 2
}
```



