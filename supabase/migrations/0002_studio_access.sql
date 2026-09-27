-- 0002_studio_access.sql
-- Кто имеет право записывать жесты.
--
-- Зачем. 0001 разрешает писать в gestures любому вошедшему пользователю — свои
-- строки, чужие не тронуть. Для копилки КЖЯ этого мало: случайный человек
-- зайдёт, накидает мусорных знаков, и корпус придётся чистить руками. Запись
-- должна быть открыта поимённо — автору проекта и сурдопереводчику.
--
-- Список — таблица, а не константа в политике: добавить человека тогда INSERT,
-- а не новая миграция. Ровно так же в 0001 сделан справочник языков.
--
-- Кнопка в интерфейсе прячется отдельно (src/lib/studioAccess.ts), но это
-- только косметика: публичный anon-ключ лежит в бандле, и запрос к API можно
-- отправить мимо интерфейса. Настоящий запрет — здесь.
--
-- Требует применённого 0001. Идемпотентна.

begin;

-- ---------------------------------------------------------------------------
-- 1. Список тех, кому открыта запись
-- ---------------------------------------------------------------------------

create table if not exists public.gesture_recorders (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  note        text,          -- «автор проекта», «сурдопереводчик» — для памяти
  created_at  timestamptz not null default now()
);

comment on table public.gesture_recorders is
  'Поимённый список тех, кому разрешено записывать жесты. Заполняется вручную через SQL Editor или service_role.';

alter table public.gesture_recorders enable row level security;
alter table public.gesture_recorders force row level security;

-- Свою строку видно — по ней интерфейс понимает, показывать ли студию.
-- Чужие строки не видны никому: список людей наружу не отдаём.
drop policy if exists gesture_recorders_select_self on public.gesture_recorders;
create policy gesture_recorders_select_self
  on public.gesture_recorders
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Писать в сам список нельзя никому: ни INSERT, ни UPDATE, ни DELETE политик
-- нет, значит операция запрещена. Пополнение — только service_role, который
-- RLS обходит (SQL Editor в дашборде работает именно так).

grant select on public.gesture_recorders to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Кто в списке — тот и пишет
-- ---------------------------------------------------------------------------

create or replace function public.may_record_gestures()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.gesture_recorders r where r.user_id = auth.uid()
  );
$$;

comment on function public.may_record_gestures is
  'true, если текущий пользователь в списке gesture_recorders. security definer, чтобы политика видела всю таблицу, а не только свою строку.';

revoke all on function public.may_record_gestures() from public;
grant execute on function public.may_record_gestures() to authenticated;

-- Чтение жестов не трогаем: смотреть свои и публичные могут все.
-- Меняем только запись — она теперь требует членства в списке.

drop policy if exists gestures_insert_own on public.gestures;
create policy gestures_insert_own
  on public.gestures
  for insert
  to authenticated
  with check (
    owner = (select auth.uid())
    and (select public.may_record_gestures())
  );

drop policy if exists gestures_update_own on public.gestures;
create policy gestures_update_own
  on public.gestures
  for update
  to authenticated
  using (
    owner = (select auth.uid())
    and (select public.may_record_gestures())
  )
  with check (
    owner = (select auth.uid())
    and (select public.may_record_gestures())
  );

-- Удаление оставляем владельцу без условия: убрать собственную запись человек
-- должен мочь всегда, даже если его уже вычеркнули из списка.

-- ---------------------------------------------------------------------------
-- 3. Сырые кадры в Storage — то же правило
-- ---------------------------------------------------------------------------
-- Иначе запись в приватный бакет осталась бы открыта всем вошедшим.

drop policy if exists gesture_landmarks_insert_own on storage.objects;
create policy gesture_landmarks_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'gesture-landmarks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.may_record_gestures())
  );

drop policy if exists gesture_landmarks_update_own on storage.objects;
create policy gesture_landmarks_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'gesture-landmarks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'gesture-landmarks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.may_record_gestures())
  );

-- ---------------------------------------------------------------------------
-- 4. Выдать доступ
-- ---------------------------------------------------------------------------
-- Почта берётся из auth.users, поэтому аккаунт должен быть уже создан.
-- Ничего не делает, если такого пользователя нет — проверьте выборкой ниже.

insert into public.gesture_recorders (user_id, note)
select id, 'автор проекта'
from auth.users
where lower(email) = lower('niazbekelnar@gmail.com')
on conflict (user_id) do nothing;

commit;

-- Проверка: должна вернуть одну строку с вашей почтой.
--   select u.email, r.note, r.created_at
--     from public.gesture_recorders r join auth.users u on u.id = r.user_id;
--
-- Добавить сурдопереводчика, когда заведёте ему аккаунт:
--   insert into public.gesture_recorders (user_id, note)
--   select id, 'сурдопереводчик' from auth.users
--    where lower(email) = lower('ПОЧТА')
--   on conflict (user_id) do nothing;
-- и дописать ту же почту в STUDIO_EMAILS (src/lib/studioAccess.ts), иначе
-- кнопки «Записать жест» человек просто не увидит.
--
-- Забрать доступ:
--   delete from public.gesture_recorders r using auth.users u
--    where u.id = r.user_id and lower(u.email) = lower('ПОЧТА');
