-- 0001_gestures.sql
-- User-recorded sign-language gestures for Qyran.
--
-- Context / design decisions (see the bottom of this file for the full rationale):
--   * The playable retargeted clip is stored INLINE in a jsonb column. Measured
--     payloads in public/gestures/slovo are 17-49 KB (p50 ~38 KB), which Postgres
--     TOASTs and compresses out-of-line automatically. Keeping it inline gives us
--     one round trip, transactional consistency, and a single RLS surface.
--   * The RAW MediaPipe landmark frames are 5-20x larger, write-once/read-rarely,
--     and only needed for future ML training. They go to a private Storage bucket;
--     the row carries a pointer plus an explicit training-consent flag.
--
-- Safe to run more than once (idempotent where practical).

begin;

-- ---------------------------------------------------------------------------
-- 0. Prerequisites
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;  -- gen_random_uuid()


-- ---------------------------------------------------------------------------
-- 1. Reference table: sign languages
-- ---------------------------------------------------------------------------
-- A lookup table rather than an enum: adding a language later is an INSERT, not
-- an ALTER TYPE (which cannot run inside a transaction alongside its first use).
--
-- Codes: 'rsl' is the real ISO 639-3 code for Russian Sign Language. Kazakh Sign
-- Language has NO assigned ISO 639-3 code (it is usually catalogued inside the
-- RSL family), so 'ksl' below is a project-local code. It is deliberately in a
-- table so it can be swapped for a standard code without touching the data model.

create table if not exists public.sign_languages (
  code         text primary key
                 constraint sign_languages_code_chk
                 check (code ~ '^[a-z]{2,12}(-[a-z0-9]{2,8})*$'),
  name_en      text not null,
  name_ru      text,
  name_kk      text,
  iso_639_3    text,          -- null when the language has no assigned ISO code
  created_at   timestamptz not null default now()
);

comment on table public.sign_languages is
  'Controlled vocabulary of sign languages. Read-only to clients.';
comment on column public.sign_languages.iso_639_3 is
  'ISO 639-3 code where one exists; null for languages with no assigned code (e.g. Kazakh SL).';

insert into public.sign_languages (code, name_en, name_ru, name_kk, iso_639_3) values
  ('rsl', 'Russian Sign Language', 'Русский жестовый язык', 'Орыс ым тілі',   'rsl'),
  ('ksl', 'Kazakh Sign Language',  'Казахский жестовый язык', 'Қазақ ым тілі', null)
on conflict (code) do nothing;


-- ---------------------------------------------------------------------------
-- 2. Main table: gestures
-- ---------------------------------------------------------------------------

create table if not exists public.gestures (
  id            uuid primary key default gen_random_uuid(),

  -- Ownership. `default auth.uid()` means the client never has to send it, and
  -- the RLS WITH CHECK below makes it impossible to forge.
  owner         uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,

  -- The label the user typed, e.g. 'сәлем'. Kept verbatim for display.
  word          text not null
                  constraint gestures_word_len_chk
                  check (char_length(btrim(word)) between 1 and 128),

  -- Normalised form used for uniqueness and lookup. lower() and btrim() are both
  -- IMMUTABLE and handle Cyrillic/Kazakh correctly under a UTF-8 database.
  word_norm     text generated always as (lower(btrim(word))) stored,

  language      text not null default 'ksl'
                  references public.sign_languages (code) on update cascade,

  -- The playable clip, same shape as public/gestures/*.json:
  --   { "fps_target": 30, "rotation_order": "XYZ", "unit": "radians",
  --     "frames": [ { "t": 0.0, "bones": { "mixamorig:RightArm": [x,y,z], ... } } ] }
  clip          jsonb not null
                  constraint gestures_clip_shape_chk
                  check (
                    jsonb_typeof(clip) = 'object'
                    and jsonb_typeof(clip -> 'frames') = 'array'
                  ),

  -- Denormalised for cheap listing/QA without detoasting `clip`.
  -- The CASE keeps the expression total, so a malformed clip can never raise a
  -- hard error here; the CHECK constraint below produces the clean rejection.
  frame_count   integer generated always as (
                  case when jsonb_typeof(clip -> 'frames') = 'array'
                       then jsonb_array_length(clip -> 'frames')
                       else 0 end
                ) stored,

  fps_target    smallint not null default 30
                  constraint gestures_fps_chk check (fps_target between 1 and 240),
  duration_ms   integer
                  constraint gestures_duration_chk
                  check (duration_ms is null or duration_ms between 1 and 600000),

  -- Pointer to the raw MediaPipe Holistic capture in Storage.
  -- Convention: '<owner uuid>/<gesture id>.f32.gz' in the 'gesture-landmarks'
  -- bucket: gzipped little-endian Float32, row-major, 255 floats per frame in the
  -- layout defined by src/lib/landmarks.ts (pose 33, face-key 10, hands 21+21).
  -- landmark_frames lets a loader reshape the buffer without parsing it.
  -- Null when the gesture was imported rather than recorded, or consent was withheld.
  landmarks_path   text
                     constraint gestures_landmarks_path_chk
                     check (landmarks_path is null or char_length(landmarks_path) between 1 and 1024),
  landmarks_bytes  bigint
                     constraint gestures_landmarks_bytes_chk
                     check (landmarks_bytes is null or landmarks_bytes >= 0),

  -- Shape of the blob above, so a training loader can reshape it without reading
  -- the file first: buffer is landmark_frames x landmark_dim float32.
  landmark_frames  integer
                     constraint gestures_landmark_frames_chk
                     check (landmark_frames is null or landmark_frames between 1 and 20000),
  landmark_dim     smallint not null default 255
                     constraint gestures_landmark_dim_chk check (landmark_dim > 0),

  -- Explicit, revocable opt-in. Landmarks are biometric-adjacent; never train on
  -- a recording whose owner has not set this to true.
  consent_ml_training boolean not null default false,

  -- Optional sharing. Drives the public-read RLS policy below.
  is_public     boolean not null default false,

  source        text not null default 'user_recording'
                  constraint gestures_source_chk
                  check (source in ('user_recording', 'slovo_import', 'manual')),

  description   text
                  constraint gestures_description_len_chk
                  check (description is null or char_length(description) <= 2000),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A clip with fewer than 2 frames cannot animate. Written against the source
  -- expression rather than the generated `frame_count` column: CHECK constraints
  -- on a row are evaluated in an unspecified order, so this stays self-contained
  -- and total (the CASE means a malformed clip yields 0 and a clean violation,
  -- never a raised error from jsonb_array_length).
  constraint gestures_frame_count_chk check (
    case when jsonb_typeof(clip -> 'frames') = 'array'
         then jsonb_array_length(clip -> 'frames')
         else 0 end
    between 2 and 5000
  ),

  -- One gesture per (user, word, language). Re-recording is an UPSERT:
  --   insert ... on conflict (owner, word_norm, language) do update
  --     set clip = excluded.clip, updated_at = now();
  constraint gestures_owner_word_language_key unique (owner, word_norm, language)
);

comment on table public.gestures is
  'User-recorded sign gestures. `clip` holds the retargeted, playable animation inline; raw landmark captures live in the gesture-landmarks Storage bucket.';
comment on column public.gestures.clip is
  'Retargeted bone-rotation animation, typically 20-50 KB. Do not SELECT it in list views.';
comment on column public.gestures.consent_ml_training is
  'User opt-in for using the raw landmarks as ML training data. Revocable.';


-- ---------------------------------------------------------------------------
-- 3. updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gestures_set_updated_at on public.gestures;
create trigger gestures_set_updated_at
  before update on public.gestures
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
-- Each one maps to a query the app actually runs.

-- "My gestures, newest first" — the library screen.
--   select id, word, language, frame_count, created_at
--     from gestures where owner = auth.uid() order by created_at desc;
create index if not exists gestures_owner_created_at_idx
  on public.gestures (owner, created_at desc);

-- "Does this user already have a sign for this word?" — the record/save flow.
-- Also backs the unique constraint's conflict target.
create index if not exists gestures_owner_language_word_idx
  on public.gestures (owner, language, word_norm);

-- "Find a public sign for this word in this language" — the translator fallback
-- when the built-in library has no entry. Partial: only public rows are ever
-- searched this way, which keeps the index small.
create index if not exists gestures_public_word_lookup_idx
  on public.gestures (language, word_norm)
  where is_public;

-- Prefix / autocomplete search over the shared corpus.
create index if not exists gestures_public_word_prefix_idx
  on public.gestures (language, word_norm text_pattern_ops)
  where is_public;

-- Training-set assembly: "all consented recordings that still have landmarks".
create index if not exists gestures_training_pool_idx
  on public.gestures (language, created_at)
  where consent_ml_training and landmarks_path is not null;


-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.gestures        enable row level security;
alter table public.sign_languages  enable row level security;

-- Force RLS even for the table owner role, so a mistake elsewhere cannot bypass it.
alter table public.gestures        force row level security;

-- Reference data is world-readable, writable only by service_role (which bypasses RLS).
drop policy if exists sign_languages_read_all on public.sign_languages;
create policy sign_languages_read_all
  on public.sign_languages
  for select
  to anon, authenticated
  using (true);

-- Read: your own rows, plus anything explicitly shared.
drop policy if exists gestures_select_own_or_public on public.gestures;
create policy gestures_select_own_or_public
  on public.gestures
  for select
  to anon, authenticated
  using (owner = (select auth.uid()) or is_public);

-- Insert: only ever as yourself.
drop policy if exists gestures_insert_own on public.gestures;
create policy gestures_insert_own
  on public.gestures
  for insert
  to authenticated
  with check (owner = (select auth.uid()));

-- Update: only your own rows, and you cannot hand a row to someone else
-- (USING gates which rows you may touch, WITH CHECK gates the result).
drop policy if exists gestures_update_own on public.gestures;
create policy gestures_update_own
  on public.gestures
  for update
  to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

drop policy if exists gestures_delete_own on public.gestures;
create policy gestures_delete_own
  on public.gestures
  for delete
  to authenticated
  using (owner = (select auth.uid()));

-- Note: `(select auth.uid())` rather than a bare `auth.uid()` is deliberate —
-- it lets Postgres evaluate the current user once per query instead of once per
-- row, which is a large difference on the listing queries.

-- Explicit grants. RLS narrows what these can reach; without a grant the
-- policies are never even consulted.
grant usage on schema public to anon, authenticated;
grant select on public.sign_languages to anon, authenticated;
grant select on public.gestures to anon;                      -- public rows only, via RLS
grant select, insert, update, delete on public.gestures to authenticated;


-- ---------------------------------------------------------------------------
-- 6. Storage: raw landmark captures
-- ---------------------------------------------------------------------------
-- Private bucket. Path convention is '<owner uuid>/<gesture id>.json.gz', so the
-- first path segment is the owner and the policies below can enforce ownership
-- without a join.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gesture-landmarks',
  'gesture-landmarks',
  false,
  20971520,                                   -- 20 MB ceiling per capture
  array['application/json', 'application/gzip', 'application/octet-stream']
)
on conflict (id) do nothing;

drop policy if exists gesture_landmarks_select_own on storage.objects;
create policy gesture_landmarks_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'gesture-landmarks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists gesture_landmarks_insert_own on storage.objects;
create policy gesture_landmarks_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'gesture-landmarks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
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
  );

drop policy if exists gesture_landmarks_delete_own on storage.objects;
create policy gesture_landmarks_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'gesture-landmarks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;


-- ===========================================================================
-- WHY INLINE jsonb FOR THE CLIP, STORAGE FOR THE LANDMARKS
-- ===========================================================================
--
-- Measured from this repo (find public/gestures/slovo -name '*.json' | stat):
--   965 SLOVO clips, min 16.8 KB, p50 38.5 KB, p90 49.3 KB, max 49.4 KB, 35.8 MB total.
--   The seven hand-authored clips in public/gestures are 3.6 KB - 252 KB.
--   Shape: { name, fps_target, rotation_order, unit, description,
--            frames: [ { t, bones: { "mixamorig:*": [x,y,z] } } ] }  (32 frames x 34 bones)
--
-- Clip inline in jsonb:
--   - At ~38 KB it is far past the 2 KB TOAST threshold, so Postgres already
--     stores it out-of-line and compressed. Arrays of floats compress well, so
--     real on-disk cost lands near 10 KB/row. 10k user recordings is ~100-150 MB.
--   - One round trip to fetch row + animation. A Storage design needs a table
--     read, then a signed-URL mint, then a CDN fetch, before the avatar can move.
--   - Transactional: no orphaned objects when an insert rolls back, and no
--     dangling rows pointing at deleted files. Storage has no transactional tie
--     to the table, so that reconciliation becomes your problem forever.
--   - One security surface. RLS on the table already governs it; Storage would
--     add a second, independently-misconfigurable policy set.
--   - Queryable: frame_count, bone coverage, and QA checks are plain SQL.
--   The cost is that `select *` detoasts ~38 KB per row, so list views must
--   enumerate columns and omit `clip`. That is a one-line discipline, and the
--   indexes above are built for exactly those column lists.
--
-- Raw landmarks in Storage:
--   - Per src/lib/landmarks.ts the capture vector is fixed-width: 255 floats per
--     frame — pose(33*3) + face(10*3) + left_hand(21*3) + right_hand(21*3) — which
--     is the SLOVO-compatible layout the recognizer already consumes. A 3-second
--     take at 30 fps is ~23k floats: ~92 KB as raw Float32, but ~200 KB once
--     serialised to JSON, i.e. 2-5x the clip and growing linearly with take length.
--   - Because it is a FIXED-WIDTH numeric matrix, jsonb is the worst possible
--     container for it: per-element tag overhead, no columnar access, and the
--     training job wants a contiguous Float32 buffer anyway. Store it as a compact
--     binary blob (Float32 little-endian, gzipped) and keep the frame count in the
--     row, so a loader can mmap it straight into a tensor without a JSON parse.
--   - Access pattern is write-once, read-almost-never: nothing in the app reads
--     them, only an offline training job does. Putting cold 500 KB blobs in the
--     table inflates TOAST, backups, and restore time for data no query touches.
--   - Storage streams them, bills them as object storage, and lets a training
--     job pull them in bulk without touching the OLTP database.
--
-- SHOULD RAW LANDMARKS BE KEPT AT ALL? Yes — this is the strategic argument.
--   The existing library is Russian Sign Language (SLOVO). There is no comparable
--   Kazakh Sign Language corpus, so these user recordings ARE the KSL dataset;
--   that is most of their long-term value. Critically, the retarget is LOSSY and
--   solver-specific: `clip` bakes in today's IK/retargeting code and the Mixamo
--   skeleton, including its bugs. You can always regenerate clips from landmarks
--   when the retargeter improves; you can never recover landmarks from bone
--   rotations. Landmarks are also the exact input format the v2 recognizer
--   consumes, so each recording doubles as recognizer training/eval data rather
--   than only avatar playback.
--   The counterweight is privacy: hand and body geometry is biometric-adjacent.
--   Hence the private bucket, owner-scoped Storage policies, an explicit and
--   revocable `consent_ml_training` flag that the training pool index respects,
--   and — deliberately — no storage of the source video anywhere.
--
-- UNIQUENESS. `unique (owner, word_norm, language)` lets two users each own a
-- sign for 'сәлем', and lets one user hold both the RSL and KSL sign for the same
-- word, while preventing silent duplicates from a user re-recording. Normalising
-- through lower(btrim(...)) means 'Сәлем ' and 'сәлем' collide as they should.
-- Re-recording is an upsert on that constraint, not a second row. If you later
-- want to retain multiple takes, keep this constraint and move older takes into a
-- separate gesture_takes child table rather than relaxing it — otherwise "which
-- clip do I play for this word?" stops having an answer.
