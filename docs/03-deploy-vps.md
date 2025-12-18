## Деплой в Интернет (VPS, самый понятный путь для MVP)

Ниже вариант “минимум магии”: VPS + Node.js + reverse-proxy (Caddy).  
Если у вас будет DevOps — он сможет заменить это на Docker/Kubernetes без переписывания приложения.

### Что выбрать
Вам нужно:
- домен (например `lk.yourdomain.ru`)
- VPS (Ubuntu 22.04) у Hetzner / Selectel / DO и т.п.

### Шаг 1 — подготовить сервер
На сервере (Ubuntu):
1) Обновить пакеты
2) Установить Node.js 20
3) Установить Caddy (он сделает HTTPS автоматически)

### Шаг 2 — загрузить проект
Варианты:
- через git (рекомендуется): `git clone ...`
- или zip-архивом (если без git)

### Шаг 3 — настроить переменные окружения API
На сервере создайте файл:
- `apps/api/env.local`
и заполните как минимум:
- `JWT_ACCESS_SECRET` (длинная)
- `JWT_REFRESH_SECRET` (длинная)
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=strict`
- `API_PUBLIC_ORIGIN=https://lk.yourdomain.ru`
- `BITRIX_MODE=real` и настройки webhook (если подключаем Bitrix)

### Шаг 4 — собрать и запустить
В корне проекта:
1) `npm install`
2) `npm run db:migrate -w @lk/api`
3) `npm run build -w @lk/api`
4) `npm run build -w @lk/web`

Для “держать API всегда запущенным” обычно используют **pm2** или systemd.

### Шаг 5 — настроить HTTPS и проксирование
Идея:
- web отдаём как статические файлы (`apps/web/dist`)
- API прячем за `/api/*`

Caddy умеет:
- HTTPS по домену
- `handle_path /api/* { reverse_proxy 127.0.0.1:8080 }`
- `root * apps/web/dist`

### Следующий шаг
Напишите, где вы хотите деплоить:
- **VPS** (какой провайдер?) или
- **Render/Railway/Fly.io**

И я дам вам точные команды под выбранный вариант (буквально копировать-вставить).



