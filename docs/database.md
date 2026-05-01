# Database Schema Reference

> **Purpose:** This file is the single source of truth for the database structure.
> AI agents (Cursor, Copilot, etc.) should read this before writing any query, migration, or ORM model.

---

## Tech Stack

- **Database:** PostgreSQL
- **UUID generation:** `gen_random_uuid()` (pgcrypto / pg 13+)
- **Timestamps:** All `timestamptz` (UTC-aware). Default `now()`.
- **JSONB:** Used for flexible/nested payloads (pronunciation scores, word scores).

---

## Domain Overview

The app has four functional domains:

| Domain | Tables | Description |
|---|---|---|
| **Auth** | `users`, `refresh_tokens` | Authentication, sessions, token rotation |
| **Shadowing Content** | `video_categories`, `videos`, `subtitles` | YouTube-based pronunciation shadowing |
| **Speaking Content** | `scenario_categories`, `scenarios` | AI conversation practice scenarios |
| **User Progress** | `shadowing_attempts`, `shadowing_progress`, `speaking_sessions`, `speaking_turns` | Per-user activity tracking |
| **Vocab / SRS** | `word_sets`, `word_set_words`, `user_word_progress`, `user_dictionary` | Spaced-repetition vocabulary system |

---

## Enums

```sql
role_enum          → user | admin
provider_enum      → local | google
difficulty_level_enum → A1 | A2 | B1 | B2 | C1 | C2
turn_role_enum     → user | ai
srs_ease_enum      → again | hard | good | easy
```

---

## Auth

### `users`

Primary user accounts table. Supports local email/password and OAuth (Google).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `email` | varchar(255) | Unique, not null |
| `password_hash` | varchar(255) | Null for OAuth users |
| `provider` | `provider_enum` | Default `local` |
| `display_name` | varchar(100) | Not null |
| `role` | `role_enum` | Default `user` |
| `locale` | varchar(10) | Default `en` |
| `theme` | varchar(20) | Default `light` |
| `is_active` | boolean | Default `true` |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto — update via trigger |

**Indexes:** `email` (unique), `role`

---

### `refresh_tokens`

Stores hashed refresh tokens for JWT rotation. Never stores plaintext tokens.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | Cascade delete |
| `token_hash` | varchar(255) | SHA-256 hash of raw token; unique |
| `expires_at` | timestamptz | Hard expiry |
| `revoked_at` | timestamptz | NULL = valid; set on logout or rotation |
| `created_at` | timestamptz | Auto |

**Indexes:** `token_hash` (unique), `user_id`, `expires_at`

> **Agent note:** To validate a token: hash the incoming raw token → look up `token_hash` → check `revoked_at IS NULL AND expires_at > now()`.

---

## Shadowing Content

### `video_categories`

Organizes videos into browsable groups.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | varchar(100) | Unique URL-safe identifier |
| `name` | varchar(100) | Display name |
| `display_order` | integer | Default 0; for ordered listing |
| `created_at` | timestamptz | Auto |

---

### `videos`

YouTube videos used for pronunciation shadowing exercises.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `category_id` | uuid FK → `video_categories.id` | |
| `title` | varchar(255) | |
| `description` | text | Nullable |
| `youtube_id` | varchar(50) | 11-char YouTube ID; unique |
| `thumbnail_url` | varchar(500) | Nullable |
| `duration_sec` | integer | Video length in seconds |
| `level` | `difficulty_level_enum` | Nullable |
| `is_active` | boolean | Default `true` |
| `published_at` | timestamptz | Nullable |
| `created_at` / `updated_at` | timestamptz | Auto |

**Indexes:** `youtube_id` (unique), `category_id`, `(category_id, level, is_active)` — composite for filtered browsing queries.

---

### `subtitles`

Individual subtitle sentences within a video. Each row is one sentence to shadow.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `video_id` | uuid FK → `videos.id` | Cascade delete |
| `index` | integer | 0-based sentence position within video |
| `start_ms` | integer | Milliseconds from video start |
| `end_ms` | integer | Milliseconds from video start |
| `text` | text | English sentence |
| `translation` | text | L1 translation; null in MVP |
| `created_at` | timestamptz | Auto |

**Indexes:** `(video_id, index)` unique — enforces sentence order per video.

---

## Speaking Content

### `scenario_categories`

Groups AI conversation scenarios into categories (e.g., "At the airport", "Job interview").

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | varchar(100) | Unique |
| `name` | varchar(100) | |
| `display_order` | integer | Default 0 |
| `created_at` | timestamptz | Auto |

---

### `scenarios`

Defines AI roleplay scenarios. The `system_prompt` is injected directly into the LLM.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `category_id` | uuid FK → `scenario_categories.id` | |
| `title` | varchar(255) | |
| `description` | text | Nullable |
| `system_prompt` | text | Full prompt sent as system message to Azure OpenAI |
| `opening_line` | text | AI's first utterance before user speaks |
| `opening_audio_url` | varchar(500) | Pre-cached TTS URL for `opening_line` |
| `level` | `difficulty_level_enum` | Nullable |
| `is_active` | boolean | Default `true` |
| `created_at` / `updated_at` | timestamptz | Auto |

**Indexes:** `category_id`, `(category_id, level, is_active)` — composite for filtered browsing.

---

## User Progress — Shadowing

### `shadowing_attempts`

Each row is one pronunciation attempt by a user on a specific subtitle sentence.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | Cascade delete |
| `subtitle_id` | uuid FK → `subtitles.id` | |
| `accuracy_score` | decimal(5,2) | Azure `AccuracyScore` 0–100 |
| `fluency_score` | decimal(5,2) | Nullable |
| `completeness_score` | decimal(5,2) | Nullable |
| `word_scores` | jsonb | Array of `{ word, accuracyScore, errorType }` from Azure NBest[0].Words |
| `created_at` | timestamptz | Auto |

**Indexes:** `user_id`, `subtitle_id`, `(user_id, subtitle_id)`

> **`word_scores` shape:**
> ```json
> [
>   { "word": "hello", "accuracyScore": 95.2, "errorType": "None" },
>   { "word": "world", "accuracyScore": 61.0, "errorType": "Mispronunciation" }
> ]
> ```

---

### `shadowing_progress`

Aggregated per-user, per-video progress. One row per (user, video) pair.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | Cascade delete |
| `video_id` | uuid FK → `videos.id` | |
| `completed_sentences` | integer | Count of distinct subtitles scored ≥ threshold |
| `last_sentence_index` | integer | Most recent `subtitle.index` worked on |
| `updated_at` | timestamptz | Update on each attempt |

**Indexes:** `(user_id, video_id)` unique — one progress record per user per video.

---

## User Progress — Speaking

### `speaking_sessions`

One session = one complete conversation with an AI scenario.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | Cascade delete |
| `scenario_id` | uuid FK → `scenarios.id` | |
| `session_summary` | text | AI-generated summary; written at session end |
| `overall_score` | decimal(5,2) | Aggregated pronunciation score; nullable until session ends |
| `started_at` | timestamptz | Auto |
| `ended_at` | timestamptz | NULL = session in progress |

**Indexes:** `user_id`, `scenario_id`, `(user_id, scenario_id)`

> **Agent note:** `ended_at IS NULL` means the session is still active.

---

### `speaking_turns`

Individual turns within a speaking session, ordered by `turn_index`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → `speaking_sessions.id` | Cascade delete |
| `role` | `turn_role_enum` | `user` or `ai` |
| `text` | text | Transcript of the turn |
| `pronunciation_json` | jsonb | Azure STT + Pronunciation Assessment; null for AI turns |
| `turn_index` | integer | 0-based ordering within session |
| `created_at` | timestamptz | Auto |

**Indexes:** `(session_id, turn_index)` unique — enforces turn order per session.

---

## Vocab & SRS

### `word_sets`

Curated vocabulary collections (e.g., "Business English B2", "Travel Phrases A2").

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | varchar(100) | Unique |
| `name` | varchar(100) | |
| `description` | text | Nullable |
| `level` | `difficulty_level_enum` | Nullable |
| `cover_image_url` | varchar(500) | Nullable |
| `display_order` | integer | Default 0 |
| `is_active` | boolean | Default `true` |
| `created_at` | timestamptz | Auto |

---

### `word_set_words`

Individual word entries within a word set.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `word_set_id` | uuid FK → `word_sets.id` | Cascade delete |
| `word` | varchar(100) | |
| `ipa` | varchar(200) | IPA phonetic transcription; nullable |
| `meaning` | text | Not null |
| `example` | text | Example sentence; nullable |
| `audio_url` | varchar(500) | Pre-generated TTS audio URL |
| `display_order` | integer | Default 0 |
| `created_at` | timestamptz | Auto |

**Indexes:** `word_set_id`, `(word_set_id, display_order)`

---

### `user_word_progress`

SRS (Spaced Repetition System) state per user per word. One row per (user, word) pair.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | Cascade delete |
| `word_set_word_id` | uuid FK → `word_set_words.id` | Cascade delete |
| `ease` | `srs_ease_enum` | Last review rating |
| `next_review_at` | timestamptz | When this card is due |
| `interval_minutes` | integer | Current SRS interval |
| `updated_at` | timestamptz | Auto |

**Indexes:**
- `(user_id, word_set_word_id)` unique
- `(user_id, next_review_at)` — **critical SRS queue index**

> **SRS due-card query:**
> ```sql
> SELECT * FROM user_word_progress
> WHERE user_id = $1 AND next_review_at <= now()
> ORDER BY next_review_at ASC;
> ```

---

### `user_dictionary`

User's personal saved words, collected from any context (videos, conversations).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | Cascade delete |
| `word` | varchar(100) | |
| `meaning` | text | |
| `example` | text | Nullable |
| `source_context` | text | E.g. `"Video: Daily Conversation #3, sentence 7"` |
| `created_at` | timestamptz | Auto |

**Indexes:** `user_id`, `(user_id, word)`

---

## Relationships (All Foreign Keys)

```
refresh_tokens.user_id           → users.id              [CASCADE DELETE]
videos.category_id               → video_categories.id
subtitles.video_id               → videos.id             [CASCADE DELETE]
scenarios.category_id            → scenario_categories.id
shadowing_attempts.user_id       → users.id              [CASCADE DELETE]
shadowing_attempts.subtitle_id   → subtitles.id
shadowing_progress.user_id       → users.id              [CASCADE DELETE]
shadowing_progress.video_id      → videos.id
speaking_sessions.user_id        → users.id              [CASCADE DELETE]
speaking_sessions.scenario_id    → scenarios.id
speaking_turns.session_id        → speaking_sessions.id  [CASCADE DELETE]
word_set_words.word_set_id       → word_sets.id          [CASCADE DELETE]
user_word_progress.user_id       → users.id              [CASCADE DELETE]
user_word_progress.word_set_word_id → word_set_words.id  [CASCADE DELETE]
user_dictionary.user_id          → users.id              [CASCADE DELETE]
```

---

## Common Query Patterns

### Get all subtitles for a video (ordered)
```sql
SELECT * FROM subtitles
WHERE video_id = $1
ORDER BY index ASC;
```

### Get user's shadowing progress for a video
```sql
SELECT sp.*, v.title
FROM shadowing_progress sp
JOIN videos v ON v.id = sp.video_id
WHERE sp.user_id = $1 AND sp.video_id = $2;
```

### Get full conversation transcript for a session
```sql
SELECT role, text, pronunciation_json, turn_index
FROM speaking_turns
WHERE session_id = $1
ORDER BY turn_index ASC;
```

### Get SRS cards due for review
```sql
SELECT uwp.*, wsw.word, wsw.meaning, wsw.ipa, wsw.audio_url
FROM user_word_progress uwp
JOIN word_set_words wsw ON wsw.id = uwp.word_set_word_id
WHERE uwp.user_id = $1 AND uwp.next_review_at <= now()
ORDER BY uwp.next_review_at ASC;
```

### Get active videos filtered by category and level
```sql
SELECT * FROM videos
WHERE category_id = $1
  AND level = $2
  AND is_active = true;
```

### Validate a refresh token
```sql
SELECT * FROM refresh_tokens
WHERE token_hash = $1
  AND revoked_at IS NULL
  AND expires_at > now();
```

---

## Agent Rules & Conventions

1. **Never store raw tokens.** `refresh_tokens.token_hash` is always SHA-256 hashed.
2. **Cascade deletes are intentional.** Deleting a `user` removes all their progress, tokens, and dictionary entries.
3. **`is_active` gates content visibility.** Always filter `is_active = true` for end-user-facing queries on `videos` and `scenarios`.
4. **`ended_at IS NULL`** means a speaking session is still in progress. Don't write a summary or `overall_score` until `ended_at` is set.
5. **`subtitle.index` and `speaking_turns.turn_index`** are 0-based. Use `ORDER BY index/turn_index ASC` when reading sequences.
6. **JSONB fields** (`word_scores`, `pronunciation_json`) come from Azure Speech Services. Don't normalize them — query with `jsonb` operators when needed.
7. **SRS updates** must always recalculate `next_review_at` and `interval_minutes` together when recording a review.
8. **`updated_at` columns** should be kept current via a `BEFORE UPDATE` trigger or explicit `SET updated_at = now()` in every update statement.