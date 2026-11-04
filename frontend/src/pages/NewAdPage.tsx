import { useState } from 'react';
import { useAuth } from '../api/auth-context';
import { adsApi, imageUrl } from '../api/ads';
import type { Ad } from '../api/ads';
import { AdForm } from '../components/AdForm';

// Публикация объявления (Т2) — только для вошедших пользователей
export function NewAdPage() {
  const { token } = useAuth();
  const [created, setCreated] = useState<Ad | null>(null);

  if (created) {
    const cover = created.images[0];
    return (
      <main className="content">
        <section className="form">
          <h2>Готово!</h2>
          {cover && (
            <img
              className="ad-cover"
              src={imageUrl(cover.filename)}
              alt={created.title}
            />
          )}
          <p>
            Объявление «{created.title}» в категории «{created.category.name}»
            отправлено на модерацию. После проверки его увидят все.
          </p>
          <button type="submit" onClick={() => setCreated(null)}>
            Подать ещё одно
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="content">
      <AdForm
        heading="Новое объявление"
        hint="Объявление появится на сайте после проверки модератором."
        submitLabel="Опубликовать"
        pendingLabel="Публикация…"
        onSubmit={async (form) => setCreated(await adsApi.create(form, token!))}
      />
    </main>
  );
}
