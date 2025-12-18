## Выложить проект на GitHub + открыть сайт по ссылке (GitHub Pages) — пошагово

Мы выложим:
1) код проекта в GitHub
2) demo‑сайт в интернет через **GitHub Pages** (бесплатно)

### Часть A — создать репозиторий на GitHub (в браузере)
1) Зайдите на GitHub и создайте аккаунт (если нет)
2) Нажмите **New repository**
3) Имя, например: `lk-demo`
4) Важно: **НЕ ставьте галочки** “Add a README / .gitignore / license” (у нас уже есть)
5) Нажмите **Create repository**

После этого GitHub покажет команды для push — мы их используем.

### Часть B — загрузить код (в PowerShell, в корне проекта)
Скопируйте и выполните по очереди:

1) Инициализировать git:
```bash
git init
git branch -M main
```

2) Добавить файлы и сделать первый коммит:
```bash
git add .
git commit -m "MVP: standalone web + backend skeleton"
```

3) Подключить ваш репозиторий (замените URL на ваш из GitHub):
```bash
git remote add origin https://github.com/<ВАШ_ЛОГИН>/<ИМЯ_РЕПО>.git
git push -u origin main
```

### Часть C — включить GitHub Pages (1 раз в настройках)
1) Откройте репозиторий на GitHub
2) **Settings → Pages**
3) В разделе “Build and deployment” выберите:
- **Source: GitHub Actions**

Дальше при каждом `git push` сайт будет пересобираться автоматически.

### Где будет сайт
Обычно ссылка такая:
`https://<ВАШ_ЛОГИН>.github.io/<ИМЯ_РЕПО>/`

### Если после деплоя видите 404
Проверьте:
- вы пушите в ветку `main`
- в Settings → Pages стоит “GitHub Actions”
- откройте вкладку “Actions” и посмотрите, что workflow зелёный



