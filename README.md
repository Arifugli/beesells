# TelecomSales v2

Система управления продажами с тремя ролями: **Администратор**, **Менеджер**, **Оператор**.

## Роли

| Роль | Возможности | Вход |
|---|---|---|
| **Администратор** | Отделения, менеджеры, KPI категории | Пароль |
| **Менеджер** | Операторы своих отделений, планы KPI | Выбор из списка |
| **Оператор** | Свой дашборд, запись KPI | Выбор из списка |

## Стек

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Recharts, wouter
- **Backend:** Node.js, Express 5, Drizzle ORM, JWT (jsonwebtoken), bcrypt, Zod
- **БД:** PostgreSQL (Neon)

---

## Деплой

### 1. Neon (база данных)
1. [neon.tech](https://neon.tech) → создать проект → скопировать `DATABASE_URL`

### 2. Railway (бэкенд)
1. New Project → GitHub Repo → папка `backend`
2. Variables:
   ```
   DATABASE_URL=postgresql://...
   ALLOWED_ORIGINS=https://ВАШ_ЛОГИН.github.io
   JWT_SECRET=случайная-строка-32-символа
   ```
3. Settings → Root Directory: `backend`
4. Pre-deploy: `npm run db:push && npm run db:seed`

### 3. GitHub Pages (фронтенд)
1. Settings → Pages → Source: **GitHub Actions**
2. Secrets → `VITE_API_URL` = URL Railway сервиса
3. Variables → `VITE_BASE_URL` = `/имя-репозитория/`
4. Push в `main`

### Данные по умолчанию (seed)
- **Пароль администратора:** `admin123` (смените сразу после входа!)
- 2 менеджера, 2 отделения, 5 операторов, 4 KPI категории

---

## Локальная разработка

```bash
# Backend
cd backend
cp .env.example .env   # заполнить DATABASE_URL и JWT_SECRET
npm install
npx drizzle-kit push
npm run db:seed
npm run dev            # :3001

# Frontend
cd frontend
npm install
npm run dev            # :5173
```

---

## API

| Method | Path | Описание |
|---|---|---|
| POST | `/api/auth/login/admin` | Вход администратора (пароль) |
| POST | `/api/auth/login/select` | Вход менеджера/оператора (userId) |
| GET | `/api/auth/users?role=` | Список пользователей для входа |
| GET | `/api/admin/branches` | Отделения (admin) |
| GET | `/api/admin/managers` | Менеджеры (admin) |
| GET | `/api/admin/kpi-categories` | KPI категории (admin) |
| GET | `/api/manager/dashboard` | Дашборд менеджера |
| GET | `/api/manager/operators` | Операторы (manager) |
| POST | `/api/manager/targets` | Выставить план KPI |
| GET | `/api/operator/dashboard` | Дашборд оператора |
| POST | `/api/operator/entries` | Записать KPI |
