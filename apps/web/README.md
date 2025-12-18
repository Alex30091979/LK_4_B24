## @lk/web — Frontend (client + admin)

### Запуск (dev)
1) Запустите API (`apps/api/README.md`)
2) Запустите web:
```bash
npm run dev:web
```

По умолчанию web ожидает API на `http://localhost:8080`.
Если нужно — задайте `VITE_API_BASE_URL` (через Vite env или измените `src/config.ts`).

### UX по ролям
- **client**: mobile-first (карточки, краткая сводка, список рекомендаций, карточка договора)
- **admin**: desktop-first (таблицы, управление allowedDepth, lazy tree, audit)



