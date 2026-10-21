// Сводка по результатам тестов от лица пользователя для страницы запуска CI
import { readFileSync } from 'node:fs';

const xml = readFileSync('reports/junit.xml', 'utf8');
const head = /<testsuites\b[^>]*>/.exec(xml)?.[0] ?? '';
const attr = (name) => new RegExp(`${name}="([\\d.]+)"`).exec(head)?.[1] ?? 0;

console.log(`### Тесты от лица пользователя

| Всего | Ошибок | Пропущено | Время, с |
|---|---|---|---|
| ${attr('tests')} | ${attr('failures')} | ${attr('skipped')} | ${Number(attr('time')).toFixed(1)} |

Подробный HTML-отчёт (шаги, скриншоты и видео упавших тестов) — в артефакте **playwright-report**.`);
