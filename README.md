# notice-board

Курсовой проект КПО — веб-приложение доски объявлений с категоризацией и модерацией контента.

## Стек

- **backend** — NestJS, Prisma, PostgreSQL 16, JWT, socket.io
- **frontend** — React 19, Vite, TypeScript, Lucide React

## Структура репозитория

```
notice-board/
├── backend/            # серверная часть (NestJS)
├── frontend/           # клиентская часть (React + Vite)
│   └── src/
│       ├── api/        # HTTP-клиент к REST API
│       ├── components/ # переиспользуемые компоненты
│       ├── pages/      # страницы приложения
│       └── socket/     # WebSocket-клиент чата
├── .github/workflows/  # CI/CD-пайплайны
├── scripts/            # сбор метрик проекта
├── docker-compose.yml  # PostgreSQL для локальной разработки
└── commitlint.config.mjs
```

## Запуск

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL на localhost:5432

npm install                   # хуки git (husky + commitlint)
npm --prefix backend install
npm --prefix backend run db:deploy   # таблицы БД (миграции Prisma)
npm --prefix backend run db:seed     # модератор и базовые категории
npm --prefix backend run start:dev                                    # http://localhost:3000
npm --prefix frontend install && npm --prefix frontend run dev        # http://localhost:5173
```

Если порт 5432 занят локальным PostgreSQL, укажите в `.env` другой порт: `POSTGRES_PORT=5433` и тот же порт в `DATABASE_URL`.

Учётная запись модератора после `db:seed`: `moderator@board.local` / `moderator123` (меняется переменными `MODERATOR_EMAIL`, `MODERATOR_PASSWORD`).

## API

| Метод | Адрес | Доступ | Назначение |
|---|---|---|---|
| POST | `/auth/register` | все | регистрация, возвращает JWT |
| POST | `/auth/login` | все | вход, возвращает JWT |
| GET | `/auth/me` | авторизованные | текущий пользователь |

## Правила работы с кодом

### Коммиты

Сообщения оформляются по [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/):

```
<тип>(<область>): <описание>
```

- **Типы:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`, `perf`, `revert`.
- **Области:** `backend`, `frontend`, `ci`, `deps`, `docs`, `release`, `repo`.
- Примеры: `feat(backend): add JWT auth guard`, `fix(frontend): validate empty category name`.

Сообщения проверяет хук `commit-msg` (husky + commitlint) локально, а в CI их повторно проверяет workflow `commitlint`.

### Ветвление (GitHub Flow)

- `main` — стабильная ветка, всегда в рабочем состоянии; прямой push в неё запрещён.
- Любая работа ведётся в отдельной ветке от `main`: `feature/<задача>`, `fix/<описание>`, `ci/<описание>`, `docs/<описание>`.
- Одна ветка — одна задача из GitHub Projects (например, `feature/t1-auth`).

### Слияние

1. Ветка публикуется на GitHub, открывается Pull Request в `main` со ссылкой на задачу (`Closes #N`).
2. Автоматически запускаются проверки: commitlint, линтеры, тесты, сборка.
3. Слияние возможно только после успешного прохождения всех проверок (защита ветки `main`).
4. После слияния ветка удаляется.

### Релизы

Версии нумеруются по [SemVer](https://semver.org/lang/ru/): `vMAJOR.MINOR.PATCH`. Релиз выпускается по завершении этапа из графика работ:

```bash
git switch main && git pull
git tag -a v0.1.0 -m "Инфраструктура проекта"
git push origin v0.1.0
```

Публикация тега запускает workflow `release`, который собирает проект и создаёт GitHub Release с артефактами сборки, списком изменений и метриками этапа.

## CI/CD

| Workflow | Когда запускается | Что делает |
|---|---|---|
| `CI` | push в `main`, Pull Request в `main` | `lint` — ESLint и Prettier; `test` — модульные и интеграционные тесты, отчёты JUnit и покрытие; `build` — сборка и артефакты `backend-dist`, `frontend-dist` (только после успешных `lint` и `test`); `metrics` — сбор метрик |
| `commitlint` | Pull Request в `main` | проверка сообщений всех коммитов ветки |
| `release` | push тега `v*.*.*` | тесты, сборка, метрики, создание GitHub Release |

## Метрики

Скрипт `scripts/collect-metrics.mjs` собирает метрики при каждом запуске CI (сводка запуска и артефакт `metrics`) и в конце каждого этапа графика работ (файлы `metrics.md`, `metrics.json` в релизе этапа):

1. ошибки и предупреждения ESLint;
2. цикломатическая сложность функций (средняя и максимальная, порог — 10);
3. покрытие кода тестами (строки, ветвления, функции);
4. результаты и время выполнения тестов;
5. размер проекта (файлы и строки кода);
6. частота и средний размер коммитов, доля коммитов по Conventional Commits;
7. количество Pull Request'ов и среднее время до слияния;
8. доля успешных запусков CI и их средняя длительность.

Локальный запуск после `test:cov` / `test:e2e`: `npm run metrics`.
