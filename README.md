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
├── docker-compose.yml  # PostgreSQL для локальной разработки
└── commitlint.config.mjs
```

## Запуск

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL на localhost:5432

npm install                   # хуки git (husky + commitlint)
npm --prefix backend install && npm --prefix backend run start:dev    # http://localhost:3000
npm --prefix frontend install && npm --prefix frontend run dev        # http://localhost:5173
```

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

Публикация тега запускает workflow `release`, который собирает проект и создаёт GitHub Release с артефактами сборки и списком изменений.
