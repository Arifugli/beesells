# 📊 TelecomSales Dashboard

Панель управления продажами для телеком-операторов. Два типа пользователей: **Оператор** и **Менеджер**.

## ✨ Возможности

| Оператор | Менеджер |
|---|---|
| Личный дашборд с KPI | Общий обзор команды |
| График ежедневных продаж | Нарастающий график активности |
| Запись SIM-карт и устройств | Рейтинг операторов |
| Место в команде | Управление сотрудниками (CRUD) |
| Рекомендуемый темп продаж | Фильтрация «отстающих» |

## 🏗 Стек

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Recharts, wouter
- **Backend:** Node.js, Express 5, Drizzle ORM, Zod, TypeScript
- **База данных:** PostgreSQL (Neon / Supabase / Railway)

---

## 🚀 Деплой

### 1. База данных (Neon — бесплатно)

1. Зарегистрируйтесь на [neon.tech](https://neon.tech)
2. Создайте проект и скопируйте `DATABASE_URL`

### 2. Бэкенд (Railway)

1. Зарегистрируйтесь на [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo → выберите папку `backend`
3. Добавьте переменные окружения:
   ```
   DATABASE_URL=postgresql://...
   ALLOWED_ORIGINS=https://ВАШ_ЛОГИН.github.io
   ```
4. После деплоя скопируйте URL сервиса (например `https://telecom-api.up.railway.app`)
5. Запустите миграции и seed:
   ```bash
   cd backend
   npm install
   npx drizzle-kit push    # создать таблицы
   npm run db:seed          # заполнить тестовыми данными
   ```

### 3. Фронтенд (GitHub Pages)

1. Загрузите проект в GitHub репозиторий
2. Settings → Pages → Source: **GitHub Actions**
3. В репозитории добавьте:
   - **Secret** `VITE_API_URL` = `https://ваш-бэкенд.railway.app`
   - **Variable** `VITE_BASE_URL` = `/имя-репозитория/` (например `/telecom-sales/`)
4. Также в `frontend/vite.config.ts` убедитесь что `base` совпадает с именем репо
5. Запушьте в `main` — GitHub Actions автоматически соберёт и задеплоит

---

## 💻 Локальная разработка

```bash
# 1. Бэкенд
cd backend
cp .env.example .env
# Заполните DATABASE_URL в .env
npm install
npx drizzle-kit push
npm run db:seed
npm run dev        # запустится на :3001

# 2. Фронтенд (в другом терминале)
cd frontend
cp .env.example .env
# VITE_API_URL оставьте пустым — vite proxy перенаправит на :3001
npm install
npm run dev        # запустится на :5173
```

Откройте [http://localhost:5173](http://localhost:5173)

---

## 📁 Структура проекта

```
telecom-sales/
├── frontend/                  # React SPA (GitHub Pages)
│   ├── src/
│   │   ├── pages/             # Login, Operator, Manager pages
│   │   ├── components/        # Layout, UI компоненты
│   │   ├── hooks/             # useAuth
│   │   └── lib/               # api.ts, utils.ts
│   ├── vite.config.ts
│   └── package.json
│
├── backend/                   # Express API (Railway)
│   ├── src/
│   │   ├── routes/            # operators, sales, dashboard
│   │   ├── schema.ts          # Drizzle схема
│   │   ├── db.ts              # Neon подключение
│   │   ├── app.ts             # Express app
│   │   ├── index.ts           # Entry point
│   │   └── seed.ts            # Тестовые данные
│   ├── drizzle.config.ts
│   ├── railway.toml
│   └── package.json
│
└── .github/
    └── workflows/
        └── deploy-frontend.yml
```

---

## 🔑 API Endpoints

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/healthz` | Проверка работоспособности |
| GET | `/api/operators` | Список всех пользователей |
| POST | `/api/operators` | Создать оператора |
| PUT | `/api/operators/:id` | Обновить оператора |
| DELETE | `/api/operators/:id` | Удалить оператора |
| GET | `/api/sales` | Записи продаж |
| POST | `/api/sales` | Записать/обновить продажи за день |
| GET | `/api/dashboard/operator/:id` | Дашборд оператора |
| GET | `/api/dashboard/manager` | Дашборд менеджера |
| GET | `/api/dashboard/team-activity` | График активности команды |

---

## 📝 Лицензия

MIT
