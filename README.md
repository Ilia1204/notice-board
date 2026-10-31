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
├── e2e/                # тесты от лица пользователя (Playwright)
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

Клиент на GitHub Pages обращается к backend по адресу из переменной репозитория `API_URL` (по умолчанию `http://localhost:3000`, то есть к локально запущенному серверу). Адреса клиентов, которым backend разрешает запросы, перечисляются через запятую в `CLIENT_URL`.

Если порт 5432 занят локальным PostgreSQL, укажите в `.env` другой порт: `POSTGRES_PORT=5433` и тот же порт в `DATABASE_URL`.

Учётная запись модератора после `db:seed`: `moderator@board.local` / `moderator123` (меняется переменными `MODERATOR_EMAIL`, `MODERATOR_PASSWORD`).

## API

| Метод | Адрес | Доступ | Назначение |
|---|---|---|---|
| POST | `/auth/register` | все | регистрация, возвращает JWT |
| POST | `/auth/login` | все | вход, возвращает JWT |
| GET | `/auth/me` | авторизованные | текущий пользователь |
| GET | `/categories` | все | список категорий |
| POST | `/categories` | модератор | создание категории |
| PATCH | `/categories/:id` | модератор | изменение категории |
| DELETE | `/categories/:id` | модератор | удаление категории (409, если в ней есть объявления) |
| POST | `/ads` | авторизованные | публикация объявления (без цены — «договорная») |

## Тестирование

| Вид | Где | Инструмент | Запуск |
|---|---|---|---|
| Модульные (сервисы, контроллеры, guard'ы) | `backend/src/**/*.spec.ts` | Jest | `npm --prefix backend run test:cov` |
| Интеграционные (HTTP-запросы к API) | `backend/test/*.e2e-spec.ts` | Jest + Supertest | `npm --prefix backend run test:e2e` |
| Модульные (страницы и компоненты) | `frontend/src/**/*.test.ts(x)` | Vitest + Testing Library | `npm --prefix frontend run test:cov` |
| От лица пользователя (браузер) | `e2e/tests/*.spec.ts` | Playwright | `npm run test:e2e` |

Тесты от лица пользователя открывают приложение в Chromium и проходят сценарии задач (регистрация, вход, управление категориями, публикация объявления) на настоящих backend и базе данных. Перед запуском нужны поднятая база (`docker compose up -d`, `db:deploy`, `db:seed`) и один раз — браузер: `npx --prefix e2e playwright install chromium`. Backend и frontend Playwright запускает сам (или использует уже запущенные).

Отчёты о тестировании:

- **в CI** — сводка на странице запуска в Actions (покрытие, итоги e2e и отчёты «Тесты (backend)», «Тесты (frontend)», «Тесты (e2e)» со списком всех тестов в *Expand for details*), артефакты `test-reports-*` (JUnit, HTML-покрытие) и `playwright-report` (HTML-отчёт со скриншотами, видео и трассировкой упавших тестов);
- **локально** — `frontend/coverage/index.html`, `backend/coverage/lcov-report/index.html`, `npm --prefix e2e run report` (HTML-отчёт Playwright).

## Правила работы с кодом

### Коммиты

Сообщения оформляются по [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/):

```
<тип>(<область>): <описание>
```

- **Типы:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`, `perf`, `revert`.
- **Области:** `backend`, `frontend`, `e2e`, `ci`, `deps`, `docs`, `release`, `repo`.
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
| `CI` | push в `main`, Pull Request в `main` | `lint` — ESLint и Prettier; `test` — модульные и интеграционные тесты, отчёты JUnit и покрытие; `e2e` — тесты от лица пользователя в браузере на PostgreSQL, HTML-отчёт Playwright; `build` — сборка и артефакты `backend-dist`, `frontend-dist` (только после успешных `lint`, `test` и `e2e`); `metrics` — сбор метрик |
| `commitlint` | Pull Request в `main` | проверка сообщений всех коммитов ветки |
| `release` | push тега `v*.*.*` | тесты, сборка, метрики, создание GitHub Release |
| `pages` | push в `main` с изменениями `frontend/` | сборка клиента и публикация на GitHub Pages: https://ilia1204.github.io/notice-board/ |

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
