import type { User } from '@supabase/supabase-js';

/**
 * Кому открыта студия записи жестов.
 *
 * Запись — не обычная функция приложения, а пополнение будущего датасета КЖЯ:
 * случайный человек, зашедший «потыкать», засорит библиотеку мусорными знаками.
 * Поэтому список закрытый.
 *
 * Чтобы добавить сурдопереводчика — допишите его почту сюда И в таблицу
 * gesture_recorders (см. supabase/migrations/0002_studio_access.sql).
 * Список здесь прячет кнопку, таблица запрещает запись на стороне базы.
 *
 * ВАЖНО: это НЕ защита. Всё, что решает браузер, обходится за минуту через
 * консоль или прямой вызов API с публичным anon-ключом. Единственный настоящий
 * замок — политики RLS в базе. Здесь мы только не показываем лишнего.
 */
const STUDIO_EMAILS: readonly string[] = [
  'niazbekelnar@gmail.com',
];

/** Пускать ли этого пользователя в студию записи жестов. */
export function canRecordGestures(user: User | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return STUDIO_EMAILS.some((allowed) => allowed.toLowerCase() === email);
}
