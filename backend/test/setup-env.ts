import { tmpdir } from 'node:os';
import { join } from 'node:path';

// В CI нет файла .env — задаём переменные, нужные для запуска модулей
process.env.JWT_SECRET ??= 'e2e-test-secret';
// Фото из интеграционных тестов складываются во временную папку
process.env.UPLOAD_DIR ??= join(tmpdir(), 'notice-board-e2e-uploads');
