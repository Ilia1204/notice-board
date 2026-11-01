import { Transform } from 'class-transformer';

// Обрезает пробелы по краям до проверки длины: строка из одних пробелов не пройдёт MinLength
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
