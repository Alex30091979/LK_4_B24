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

### Шаг 2 — включить API и создать Service Account (детально)

#### 2.1 Откройте Google Cloud Console
Перейдите по ссылке: https://console.cloud.google.com/

Если у вас нет проекта — создайте новый:
1. Вверху страницы нажмите на выпадающее меню проектов (рядом с "Google Cloud")
2. Нажмите **«Новый проект»** (New Project)
3. Введите название (например `lk-client-db`) → **Создать**
4. Дождитесь создания и убедитесь, что выбран этот проект

#### 2.2 Включите Google Sheets API
1. В левом меню выберите **«API и сервисы»** → **«Библиотека»**  
   Или откройте напрямую: https://console.cloud.google.com/apis/library
2. В поиске введите **Google Sheets API**
3. Нажмите на результат **«Google Sheets API»**
4. Нажмите синюю кнопку **«Включить»** (Enable)

#### 2.3 Создайте Service Account
1. В левом меню выберите **«API и сервисы»** → **«Учётные данные»**  
   Или откройте: https://console.cloud.google.com/apis/credentials
2. Вверху нажмите **«+ Создать учётные данные»** → **«Сервисный аккаунт»**
3. Заполните:
   - **Название**: `lk-sheets-db` (любое понятное вам)
   - **ID**: оставьте автоматический или введите `lk-sheets-db`
   - **Описание**: можно пропустить
4. Нажмите **«Создать и продолжить»**
5. На шаге «Предоставить доступ» — **пропустите** (нажмите «Продолжить»)
6. На шаге «Предоставить пользователям доступ» — **пропустите** (нажмите «Готово»)

#### 2.4 Создайте JSON-ключ для Service Account
1. В списке «Сервисные аккаунты» найдите созданный аккаунт
2. Нажмите на его **email** (например `lk-sheets-db@lk-client-db.iam.gserviceaccount.com`)
3. Перейдите на вкладку **«Ключи»** (Keys)
4. Нажмите **«Добавить ключ»** → **«Создать новый ключ»**
5. Выберите **JSON** → **«Создать»**
6. Файл (например `lk-client-db-abc123.json`) скачается автоматически

**⚠️ Важно**: Этот файл — секрет! Никому не передавайте и не коммитьте в git.

### Шаг 3 — дать доступ таблице сервисному аккаунту

1. Откройте скачанный JSON-файл в любом текстовом редакторе (Блокнот, VS Code)
2. Найдите строку `"client_email":` — скопируйте email  
   Пример: `lk-sheets-db@lk-client-db.iam.gserviceaccount.com`
3. Откройте вашу Google Таблицу:  
   https://docs.google.com/spreadsheets/d/1fcbBoF37l1EDrUWgKtMcJvj3-cyXNJlG03fVB6YMlfk/edit
4. Нажмите зелёную кнопку **«Настройки доступа»** (Share) в правом верхнем углу
5. В поле «Добавить пользователей» вставьте email сервисного аккаунта
6. Справа от поля выберите роль **«Редактор»** (Editor)
7. **Снимите галочку** «Уведомить пользователей» (Notify people) — сервисный аккаунт не имеет почты
8. Нажмите **«Поделиться»** (Share)

Теперь API сможет читать и писать в эту таблицу.

### Шаг 4 — закодировать JSON в base64

Вариант A — **PowerShell** (рекомендуется для Windows):
```powershell
# Замените путь на реальный путь к скачанному файлу
$json = Get-Content "C:\Users\a.ramensky\Downloads\lk-client-db-abc123.json" -Raw
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
```
Результат — длинная строка без переносов. Скопируйте её целиком.

Вариант B — **онлайн** (если лень с терминалом):
1. Откройте https://www.base64encode.org/
2. Вставьте **весь текст** JSON-файла
3. Нажмите Encode
4. Скопируйте результат

**⚠️ Внимание**: онлайн-конвертер видит ваш секретный ключ. Используйте только если доверяете сервису, или лучше — PowerShell.

Результат — это значение для `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.

### Шаг 5 — включить режим STORAGE=sheets

Создайте (или откройте) файл `apps/api/env.local` и добавьте:

```env
STORAGE=sheets
SHEETS_SPREADSHEET_ID=1fcbBoF37l1EDrUWgKtMcJvj3-cyXNJlG03fVB6YMlfk
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<вставьте_base64_из_шага_4>
```

Замените `<вставьте_base64_из_шага_4>` на строку из предыдущего шага (без кавычек, без переносов).

### Шаг 6 — запустить API и создать первого admin

#### 6.1 Установите зависимости API
Откройте PowerShell в папке проекта и выполните:
```powershell
npm install -w @lk/shared -w @lk/api --include-workspace-root=false --no-audit --no-fund
```

#### 6.2 Добавьте одноразовый токен для создания admin
В файл `apps/api/env.local` добавьте ещё одну строку:
```env
SETUP_TOKEN=my-secret-setup-token-12345
```
(можете придумать любой длинный секрет)

#### 6.3 Запустите API
```powershell
npm run dev:api
```
Дождитесь сообщения вида:
```
{"level":30,"time":...,"msg":"Server listening at http://127.0.0.1:8080"}
```
**Не закрывайте это окно** — API должен работать.

При первом запуске в вашей Google Таблице автоматически появятся листы:
`Users`, `Sessions`, `TotpSecrets`, `SmsCodes`, `AuthAttempts`, `AuditLog`, `ReferralEdges`, `Contracts`, `AppSettings`

#### 6.4 Создайте первого admin (в новом окне PowerShell)
```powershell
$token = "my-secret-setup-token-12345"
$body = @{
  email = "admin@example.com"
  password = "VashSuperParol123!"
  bitrixContactId = "1000"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method Post -Uri "http://localhost:8080/setup/bootstrap-admin" -Headers @{ "x-setup-token" = $token } -Body $body -ContentType "application/json"
```

Если всё OK, вы увидите:
```json
{"ok":true,"userId":"...","email":"admin@example.com"}
```

#### 6.5 Готово!
Теперь можете:
- Открыть http://localhost:8080 (если фронт собран) или http://localhost:5173 (dev режим фронта)
- Войти по email/паролю, который указали выше
- Посмотреть данные прямо в Google Таблице — там появятся записи в листах `Users`, `AuditLog` и т.д.

**⚠️ После создания admin рекомендуется удалить `SETUP_TOKEN` из `env.local`** — он больше не нужен.



