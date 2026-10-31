// В CI нет файла .env — задаём переменные, нужные для запуска модулей
process.env.JWT_SECRET ??= 'e2e-test-secret';
// Фото из интеграционных тестов складываются во временную папку
process.env.UPLOAD_DIR ??= require('node:path').join(
  require('node:os').tmpdir(),
  'notice-board-e2e-uploads',
);
