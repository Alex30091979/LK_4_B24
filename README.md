## Личный кабинет клиента по рекомендациям (Bitrix24) — API-first

Проект: **адаптивный личный кабинет клиента** (mobile-first) и **desktop-first админка** в одном веб-приложении, с **API-first архитектурой** (готовность к Android/iOS).

### Содержание
- **Архитектура**
- **Запуск (dev)**
- **Пошагово для новичков**
- **Безопасность (реализовано)**
- **Bitrix24 интеграция**
- **Модель данных**
- **API (примеры ответов)**
- **Допущения**

### Архитектура
- **`apps/api`**: Backend API (Fastify + TypeScript), безопасность, бизнес-логика рекомендаций, интеграция с Bitrix24, кэширование.
- **`apps/web`**: Frontend (React + Vite + TypeScript), один сайт: клиентские mobile-first экраны + admin desktop-first интерфейс.
- **`packages/shared`**: общие типы DTO/enum между фронтом и бэком.

Слои в `apps/api`:
- **Integrations**: `bitrix/*` (вызовы Bitrix24 API, токены не уходят на клиент)
- **Domain**: рекомендации/дерево, контракты, агрегаты (суммы, статусы)
- **Security**: auth, refresh rotation, CSRF, rate limiting, lockouts, 2FA admin, audit log

### Запуск (dev)
Требования: Node.js 20+.

1) Скопируйте переменные окружения:
- Возьмите шаблон из `config/env.example`
- Создайте файл `.env` **в `apps/api`** (если у вас запрещено создавать `.env`, используйте `apps/api/env.local` и смотрите README в `apps/api`)

2) Установка зависимостей:
```bash
npm install
```

3) Миграции БД и запуск API:
```bash
npm run db:migrate -w @lk/api
npm run dev:api
```

4) Запуск Web:
```bash
npm run dev:web
```

### Быстрый сценарий проверки (demo)
1) API:
- `npm run db:migrate -w @lk/api`
- `npm run db:seed -w @lk/api`
- `npm run dev:api`

2) Web:
- `npm run dev:web`

3) Demo-логины:
- **client**: `client@demo.local` / `Client1234!`
- **admin**: `admin@demo.local` / `Admin1234!` (потребует 2FA)

### Пошагово для новичков
- Только сайт (без backend): `docs/00-standalone-site.md`
- Локальный запуск на Windows: `docs/01-local-run-windows.md`
- Подключение Bitrix24: `docs/02-bitrix-setup.md`
- Деплой на VPS (MVP): `docs/03-deploy-vps.md`
- Бесплатный деплой на платформы: `docs/04-deploy-free-platform.md`
- GitHub + GitHub Pages: `docs/05-github.md`

### Безопасность (реализовано)
- **Email+Password**: Argon2id (с солью, параметрами по умолчанию для `argon2`).
- **Phone+SMS code**: TTL 5 минут, лимит попыток, блокировка при подозрении на перебор.
- **Rate limiting**:
  - по IP (глобально)
  - по аккаунту/идентификатору (email/phone)
- **Экспоненциальная задержка / Retry-After** на повторные попытки.
- **Временная блокировка** после N ошибок (на уровне идентификатора).
- **2FA обязательно для admin**: TOTP (Google Authenticator / Authy).
- **Access token + refresh token**: refresh в HttpOnly cookie, **rotation** и отзыв сессий.
- **CSRF-защита** для cookie-сессий (refresh/logout).
- **Secure cookies**: HttpOnly, SameSite, Secure (в prod).
- **CAPTCHA**: подключается только при “suspicious activity” (в демо — провайдер-заглушка, место интеграции явно выделено).
- **Audit log**: попытки входа, блокировки, действия админа (включая раскрытие дерева).

### Bitrix24 интеграция
Backend поддерживает режимы:
- **`BITRIX_MODE=mock`**: локальные данные для разработки.
- **`BITRIX_MODE=real`**: вызовы Bitrix24 REST API через webhook path (`BITRIX_BASE_URL` + `BITRIX_WEBHOOK_PATH`).

Токены и доступы Bitrix **не хранятся на клиенте**.

### Модель данных (кратко)
В БД хранится:
- пользователи и роли (`client`, `admin`)
- сессии (refresh rotation)
- SMS-коды и попытки ввода
- TOTP секреты для admin
- аудит действий
- кэш/снимки данных (частичная синхронизация) для минимизации запросов к Bitrix

### API (примеры ответов)
Примеры приведены в README внутри `apps/api` (`apps/api/README.md`).

### Допущения
- GraphQL не обязателен → выбран **REST** (проще и надежнее для первой версии).
- Для dev используется **SQLite** (через Prisma), для prod легко переключить на Postgres.
- SMS отправка и CAPTCHA в демо — через интерфейсы-провайдеры (реальные провайдеры подставляются без переписывания ядра).


