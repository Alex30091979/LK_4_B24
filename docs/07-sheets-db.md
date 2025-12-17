## Google Sheets как база данных (включая пользователей/сессии) — пошагово

Это MVP‑вариант. Он работает, но помните:
- Google Sheets не является “настоящей БД”: возможны конфликты при одновременных записях.
- В таблице будут храниться **чувствительные данные** (хэши паролей, сессии). Доступ к таблице должен быть строго ограничен.

### Что вы получите
- backend хранит всё в Google Sheets
- при переносе хостинга вы просто указываете те же `SHEETS_SPREADSHEET_ID` и `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`

### Шаг 1 — создать Google Spreadsheet
1) Создайте таблицу в Google Sheets
2) Скопируйте **ID таблицы** из URL:
`https://docs.google.com/spreadsheets/d/<ID>/edit`
Это будет `SHEETS_SPREADSHEET_ID`.

### Шаг 2 — включить API и создать Service Account
1) Откройте Google Cloud Console
2) Создайте Project
3) Включите **Google Sheets API**
4) Создайте **Service Account**
5) Создайте Key → **JSON** (скачается файл)

### Шаг 3 — дать доступ таблице сервисному аккаунту
1) Откройте скачанный JSON
2) Найдите поле `client_email` (это email сервисного аккаунта)
3) В таблице Google Sheets нажмите “Поделиться” и добавьте этот email как **Editor**

### Шаг 4 — закодировать JSON в base64
В PowerShell (где лежит json файл ключа), выполните:
```powershell
$json = Get-Content .\\service-account.json -Raw
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
```
Скопируйте результат — это `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.

### Шаг 5 — включить режим STORAGE=sheets
В `apps/api/env.local` добавьте:
- `STORAGE=sheets`
- `SHEETS_SPREADSHEET_ID=...`
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=...`

### Шаг 6 — запустить API и создать первого admin
1) Установите зависимости API (не всего проекта):
```bash
npm install -w @lk/shared -w @lk/api --include-workspace-root=false --no-audit --no-fund
```

2) В `apps/api/env.local` добавьте одноразовый токен:
- `SETUP_TOKEN=любой-длинный-секрет`

3) Запустите API:
```bash
npm run dev:api
```

4) Создайте admin (через PowerShell):
```powershell
$token = "любой-длинный-секрет"
$body = @{ email="admin@yourdomain.ru"; password="ОченьСложныйПароль123!"; bitrixContactId="1000" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/setup/bootstrap-admin" -Headers @{ "x-setup-token"=$token } -Body $body -ContentType "application/json"
```

После этого вы сможете логиниться обычным способом `/auth/login/password`.


