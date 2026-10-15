// В CI нет файла .env — задаём переменные, нужные для запуска модулей
process.env.JWT_SECRET ??= 'e2e-test-secret';
