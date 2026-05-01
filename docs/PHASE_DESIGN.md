# Phase Design – English Learning Platform

> Tài liệu thiết kế giai đoạn (Design Phase) cho nền tảng học tiếng Anh lấy cảm hứng từ [senglish.net](https://senglish.net).
> Phiên bản: 0.1 · Cập nhật: 2026-04-18

---

## 1. Tổng quan dự án

### 1.1 Mục tiêu sản phẩm

Xây dựng nền tảng học tiếng Anh hướng **luyện Nói (Speaking)** cho người học trình độ A1–C2, tập trung vào hai trải nghiệm cốt lõi:

1. **Shadowing** theo video YouTube được admin tuyển chọn.
2. **Speaking Practice with AI** qua các kịch bản (scenarios) đời sống.

Các tính năng phụ trợ (Vocab + SRS + Dictionary + i18n + Theme) được xây quanh nhằm tạo hệ sinh thái học tập khép kín.

### 1.2 Đối tượng người dùng


| Role  | Mô tả                                                                            |
| ----- | -------------------------------------------------------------------------------- |
| Guest | Xem landing page, demo giới hạn.                                                 |
| User  | Người học. Có tài khoản, được lưu tiến trình (progress), word list, lịch sử SRS. |
| Admin | Quản trị video, subtitle, scenarios, word sets, user.                            |


### 1.3 Ưu tiên nền tảng

- **Web Desktop first** (desktop browser Chromium/Edge/Firefox hỗ trợ `MediaRecorder` + WebAudio).
- Responsive xuống tablet. Mobile chưa ưu tiên trong MVP.

---

## 2. Scope & MVP Definition

### 2.1 In-scope (MVP – Phase 1 & 2)

- Auth (đăng ký, đăng nhập, refresh token, role-based).
- Admin panel tối thiểu (CRUD video + subtitle, CRUD scenario).
- **Interactive Shadowing** (danh sách video → player → shadow từng câu → chấm điểm từng từ).
- **Speaking Practice with AI** (list scenario → hội thoại xoay vòng user ↔ AI).
- Progress tracking per user cho 2 luồng trên.

### 2.2 Phase 3+ (Post-MVP)

- Smart Dictionary + Word List.
- Practice Vocab (Flashcard / Typing / Listening / Reverse / Mixed).
- SRS.
- i18n giao diện (vi, en).
- Dark/Light theme.
- Admin nâng cao (dashboard, analytics).

### 2.3 Out-of-scope (không làm)

- Cho user tự paste link YouTube.
- Lưu file ghi âm lâu dài.
- Mobile native app.
- Community / social features (chia sẻ word set, leaderboard…).

---

## 3. Kiến trúc hệ thống

### 3.1 High-level architecture

```
┌───────────────────────────────┐          ┌──────────────────────────────┐
│   Next.js 15 (App Router)     │          │    Azure Cognitive Services  │
│   - Shadowing UI              │◄────────►│    - Speech to Text          │
│   - Speaking UI               │  token   │    - Pronunciation Assess.   │
│   - Admin UI                  │          │    - Text to Speech (AI say) │
└──────────────┬────────────────┘          └──────────────────────────────┘
               │ REST / JSON
               ▼
┌───────────────────────────────┐          ┌──────────────────────────────┐
│     NestJS API (Node 20)      │          │         Azure OpenAI         │
│  - Auth / RBAC                │◄────────►│   (scenario chat reply)      │
│  - Video / Subtitle           │          └──────────────────────────────┘
│  - Scenario / Messages        │
│  - Progress / SRS             │          ┌──────────────────────────────┐
│  - Speech Token Broker        │◄────────►│   PostgreSQL + Prisma ORM    │
└───────────────────────────────┘          └──────────────────────────────┘
```

### 3.2 Tech stack


| Layer         | Technology                                                                     | Lý do chọn                                                    |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Frontend      | Next.js 15 (App Router), TypeScript, TailwindCSS v4, shadcn/ui, TanStack Query | Cùng hệ sinh thái với workspace hiện tại, SSR thân thiện SEO. |
| State server  | TanStack Query                                                                 | Cache + retry đơn giản cho API REST.                          |
| i18n          | `next-intl`                                                                    | Tích hợp App Router, dynamic routes dễ dàng.                  |
| Theme         | `next-themes`                                                                  | Dark/Light chuẩn, hỗ trợ SSR không flash.                     |
| Backend       | NestJS 11, Prisma 5, PostgreSQL 16                                             | Pattern module/controller rõ ràng, phù hợp monolith modular.  |
| Auth          | JWT Access (15m) + Refresh (7d), bcrypt, HttpOnly cookie                       | Đơn giản, không phụ thuộc bên thứ ba.                         |
| Speech       | Azure Speech SDK for JavaScript (browser) + REST (token broker server)         | Yêu cầu của đề bài, có Pronunciation Assessment.              |
| LLM hội thoại | Azure OpenAI `gpt-4o-mini`                                                     | Rẻ, đủ thông minh cho role-play scenario.                     |
| Media player  | `react-youtube` (YouTube IFrame API)                                           | Kiểm soát seek, pause theo thời gian câu.                     |
| Deployment    | Vercel (FE) + Fly.io/Railway (BE) + Neon/Supabase (DB)                         | Free tier tốt, phù hợp MVP.                                   |


### 3.3 Repo strategy (khuyến nghị)

```
english-learning-platform/
├── apps/
│   ├── api/         # NestJS
│   └── web/         # Next.js
├── packages/
│   ├── shared/      # DTO types, zod schemas
│   └── ui/          # Shared components (optional)
└── docs/
    └── PHASE_DESIGN.md
```

Monorepo với `pnpm` workspace + Turborepo để share TypeScript types giữa FE–BE.

---

## 4. Data Model (Prisma-like)

Viết dưới dạng entity mô tả, có thể map 1:1 ra Prisma schema.

```prisma
// Authentication
User        { id, email, password, displayName, role: USER|ADMIN, level: A1..C2, locale, theme, createdAt }
RefreshToken{ id, userId, tokenHash, expiresAt, revokedAt }

// Content - Shadowing
Category    { id, slug, name, order }
Video       { id, categoryId, level, youtubeId, title, description, durationSec,
              thumbnailUrl, publishedAt, isActive }
Subtitle    { id, videoId, index, startMs, endMs, text, translation? } // per sentence

// Content - Speaking with AI
ScenarioCategory { id, slug, name, order }
Scenario    { id, categoryId, level, title, description, systemPrompt, openingLine, isActive }
             // systemPrompt: dùng cho Azure OpenAI
             // openingLine: câu AI nói đầu tiên (pre-computed TTS)

// User progress
ShadowingAttempt { id, userId, subtitleId, accuracyScore, fluencyScore,
                   completenessScore, wordScores: Json, createdAt }
ShadowingProgress{ id, userId, videoId, completedSentences: Int, lastSentenceIndex, updatedAt }

SpeakingSession  { id, userId, scenarioId, startedAt, endedAt }
SpeakingTurn     { id, sessionId, role: USER|AI, text, audioUrl?(null - không lưu),
                   pronunciationJson?, createdAt }

// Phase 3+: Vocab / SRS / Dictionary
WordSet     { id, slug, name, description, level, coverImage, order }
WordSetWord { id, wordSetId, word, ipa, meaning, example, audioUrl, order }

UserWordProgress {
  id, userId, wordSetWordId,
  ease: Again|Hard|Good|Easy,
  nextReviewAt,    // tính từ logic SRS
  intervalMinutes,
  updatedAt
}

UserDictionary   { id, userId, word, meaning, example, sourceContext, createdAt }
```

---

## 5. Giải pháp kỹ thuật chi tiết

### 5.1 Shadowing on Web (câu hỏi mở của bạn)

**Flow:**

1. Admin chọn video YouTube + upload file `.srt`/`.vtt` → backend parse → lưu Subtitle[] vào DB.
2. User vào `/shadowing/[videoId]`:
  - Hiển thị player YouTube (`react-youtube`), tắt native caption.
  - Hiển thị danh sách câu phụ đề bên dưới.
  - Click một câu → player seek đến `startMs`, play đến `endMs` rồi dừng.
3. User bấm nút **Record** → `navigator.mediaDevices.getUserMedia` + `MediaRecorder` lưu tạm trong bộ nhớ.
4. User bấm **Stop** → gửi audio (Blob) + reference text (câu phụ đề) vào Azure **Pronunciation Assessment**:
  - Có thể chạy **client-side** trực tiếp với Azure Speech SDK dùng token từ BE → giảm tải server.
  - Trả về JSON: `NBest[0].Words[] = { Word, AccuracyScore, ErrorType }`.
5. UI tô **xanh** khi `AccuracyScore ≥ 80`, **vàng** 60–80, **đỏ** < 60 hoặc `ErrorType != None`.
6. Gửi `ShadowingAttempt` lên BE để lưu progress. Blob audio **bị hủy** sau request.

**Diagram:**

```
User Browser                    Azure                        Our Backend
────────────                    ─────                        ───────────
[Click Record]
MediaRecorder → Blob
     │
     ├──────── getToken() ──────────────────────────────────►
     │                                               ◄───── short-lived token (10m)
     │
     ├── PronunciationAssessment(Blob, refText, token)
     │                                          ─► Azure ─►
     │                                               ◄───── { words, scores }
     │
     └──────── POST /attempts { videoId, subtitleId, scores } ─►
                                                    ◄───── ok
```

**Ghi chú implementation:**

- Dùng `MediaRecorder` với MIME `audio/webm;codecs=opus`, rồi convert sang `pcm_s16le 16kHz mono` (Azure yêu cầu) bằng `Web Audio API` `OfflineAudioContext` hoặc `ffmpeg.wasm`. → Giải pháp đơn giản nhất: SDK hỗ trợ **push audio** trực tiếp `AudioInputStream.createPushStream()`, không cần convert tay.
- Sample code (sketch):
  ```ts
  const config = SpeechConfig.fromAuthorizationToken(token, region);
  const pronunciationConfig = new PronunciationAssessmentConfig(
    referenceText, GradingSystem.HundredMark, Granularity.Word, true
  );
  const audioConfig = AudioConfig.fromWavFileInput(wavBlob);
  const recognizer = new SpeechRecognizer(config, audioConfig);
  pronunciationConfig.applyTo(recognizer);
  recognizer.recognizeOnceAsync(result => { /* extract Words[] */ });
  ```

### 5.2 Subtitle processing

- **Input:** file `.srt` hoặc `.vtt` upload từ admin. Không auto-pull từ YouTube (tránh vi phạm ToS).
- **Parser:** dùng `subsrt-ts` hoặc tự viết regex. Output chuẩn hóa:
  ```json
  [{ "index": 0, "startMs": 1240, "endMs": 3980, "text": "Hello there." }]
  ```
- **Câu quá dài** (>15s): admin có thể split tay trong UI. MVP cho phép admin edit từng dòng sau khi parse.

### 5.3 Speaking Practice with AI

**Flow một turn:**

```
(session start) ─► AI openingLine (TTS pre-cached URL) ─► user nghe
user Record → Stop
    ├── Azure STT: audio → transcript + pronunciation scores
    ├── POST /sessions/:id/turns { userText, scores }
    └── BE: gọi Azure OpenAI với history + systemPrompt → reply
        BE: gọi Azure TTS → tạo audio stream (không lưu) → trả về FE dạng base64
user nghe AI reply → lại Record → lặp lại…
```

**Prompt pattern cho Azure OpenAI:**

```
system: {scenario.systemPrompt}
        You are role-playing {scenario.title}. Keep replies under 2 sentences.
        The learner is at CEFR level {user.level}.
user:   {latest user transcript}
assistant: {AI reply}
```

Giữ context bằng cách truyền lại 5 turn gần nhất. Không dùng function calling trong MVP.

### 5.4 Azure Speech Token Broker

- **Vấn đề:** Không được để `SPEECH_KEY` xuống FE.
- **Giải pháp:** BE mở endpoint `POST /speech/token` (chỉ authenticated user), gọi `https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken` → trả về JWT sống 10 phút.
- Thêm **rate limit** (ví dụ 30 request/user/phút) để chống abuse, giữ trong ngân sách $100.

### 5.5 SRS Logic (Phase 3+)

Bảng chuyển trạng thái:


| Ease  | Interval tiếp theo                 | Ghi chú                    |
| ----- | ---------------------------------- | -------------------------- |
| Again | 0 phút (cuối queue phiên hiện tại) | Lặp lại ngay trong session |
| Hard  | 60–120 phút (cùng ngày)            | Trong ngày                 |
| Good  | 1 ngày                             | Ngày mai                   |
| Easy  | 4 ngày                             | 4 ngày sau                 |


Trường `nextReviewAt = now + intervalMinutes`. Khi user vào học, BE trả về các word có `nextReviewAt <= now` ordered asc. Toàn bộ 4 mode (Flashcard / Typing / Listening / Reverse) dùng **chung** bảng `UserWordProgress` để chấm điểm → đảm bảo "Đồng bộ hóa cách tính điểm".

### 5.6 i18n & Theme (Phase 4)

- `next-intl` với route group `[locale]`. Messages lưu trong `messages/en.json`, `messages/vi.json`.
- `next-themes` lưu preference vào `localStorage` + `class="dark"` trên `<html>`.
- User record `locale`, `theme` trong DB để đồng bộ giữa nhiều thiết bị (optional).

---

## 6. API contract (trích lược)

RESTful, version prefix `/api/v1`.

```
POST   /auth/register              { email, password, displayName }
POST   /auth/login                 { email, password } → { accessToken, (refresh in cookie) }
POST   /auth/refresh
POST   /auth/logout

GET    /categories                 → public
GET    /videos?categoryId&level    → public (listing)
GET    /videos/:id                 → includes subtitles[]

POST   /speech/token               → { token, region, expiresAt }
POST   /shadowing/attempts         { subtitleId, accuracyScore, wordScores, ... }
GET    /shadowing/progress?videoId

GET    /scenarios?level&categoryId
POST   /speaking/sessions          { scenarioId } → { sessionId, openingLine, openingAudio }
POST   /speaking/sessions/:id/turns{ userText, pronunciationJson }
                                   → { aiText, aiAudio(base64) }

# Admin (role=ADMIN)
POST   /admin/videos               (multipart: metadata + srt file)
PATCH  /admin/videos/:id
POST   /admin/videos/:id/subtitles (bulk)
POST   /admin/scenarios
...
```

Dùng **Zod** schema để share giữa FE-BE (qua package `shared`).

---

## 7. UI/UX wireframe (mô tả)

### 7.1 Trang chính

- `/` Landing (feature highlight, CTA đăng ký).
- `/shadowing` – Grid video có filter Category + Level.
- `/shadowing/[id]` – Split layout: trái video player sticky, phải list câu + record panel.
- `/speaking` – Grid scenario với badge level.
- `/speaking/[id]` – Chat UI (AI messages bubble trái, user bubble phải, mic button to ở giữa dưới).
- `/vocab` – list word set → `/vocab/[set]/practice?mode=flashcard`.
- `/dictionary` – lookup + word list cá nhân.
- `/profile` – tiến trình, streak, cài đặt (locale, theme).

### 7.2 Admin

- `/admin/videos`, `/admin/scenarios`, `/admin/word-sets`, `/admin/users`.

### 7.3 Nguyên tắc UI

- Focus mode khi shadowing/speaking (ẩn navbar, max 1 chính chỉ 1 CTA).
- Feedback tức thời (tô màu từ) xuất hiện trong <1s sau Stop.
- Keyboard shortcut: `Space` = start/stop record, `R` = replay, `→` = next sentence.

---

## 8. Non-functional requirements


| Aspect        | Target                                                                          |
| ------------- | ------------------------------------------------------------------------------- |
| Performance   | FCP < 2s (desktop cáp quang), pronunciation feedback < 2.5s sau stop.           |
| Security      | HTTPS bắt buộc, JWT HttpOnly cookie, CSRF cho mutation, rate limit auth/speech. |
| Availability  | 99% (MVP chấp nhận tier free).                                                  |
| Observability | `pino` log JSON + Sentry FE/BE, request id end-to-end.                          |
| Cost control  | Azure $100 → cap 2000 phút speech/tháng, alert ở 70%. Cache TTS opening line.   |
| Accessibility | WCAG AA cơ bản: contrast, focus ring, aria cho record button.                   |


---

## 9. Roadmap đề xuất (≈16 tuần)


| Phase | Tuần  | Mục tiêu                                                               | Deliverable                                 |
| ----- | ----- | ---------------------------------------------------------------------- | ------------------------------------------- |
| 0     | 1     | Setup monorepo, CI, lint, auth skeleton                                | Dev environment chạy được, /auth hoạt động. |
| 1     | 2–5   | Shadowing MVP (admin import video, user shadow, pronunciation scoring) | Luồng shadowing end-to-end demo được.       |
| 2     | 6–9   | Speaking with AI (scenarios + OpenAI + TTS + pronunciation)            | Demo hội thoại 5 scenarios.                 |
| 3     | 10–12 | Vocab + SRS (4 mode + logic lặp lại)                                   | Luyện 1 word set end-to-end.                |
| 4     | 13–14 | Smart Dictionary + Word List                                           | Lookup + save word có ví dụ.                |
| 5     | 15    | i18n + Dark/Light theme + Profile stats                                | Polish UI.                                  |
| 6     | 16    | Hardening: rate limit, monitoring, QA, deploy production               | Launch MVP.                                 |


---

## 10. Risks & Mitigations


| Rủi ro                                                        | Tác động | Giảm nhẹ                                                                |
| ------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| Vượt ngân sách Azure $100                                     | Cao      | Short-lived token, rate limit, cache TTS opening line, alert 70%.       |
| Pronunciation Assessment độ chính xác không đều ở accent khác | Trung    | Cho phép chọn `en-US` / `en-GB` trong profile, fallback threshold thấp. |
| YouTube gỡ video / disable embed                              | Trung    | Admin đánh dấu `isActive=false` khi phát hiện 404, có queue kiểm tra.   |
| Browser compatibility của MediaRecorder (Safari)              | Trung    | MVP chặn Safari < 14.1, show warning fallback.                          |
| Đồng bộ tiến trình giữa nhiều tab                             | Thấp     | Dùng TanStack Query + `invalidateQueries` sau mutation.                 |
| Chi phí hosting DB                                            | Thấp     | Neon free 0.5GB là đủ 6 tháng đầu.                                      |


---

## 11. Open questions (cần quyết định trước khi code)

1. **Voice AI nào?** Azure Neural TTS (có giọng `en-US-JennyNeural` rất tự nhiên) – confirm dùng?
2. **LLM có sẵn Azure OpenAI không?** Nếu chưa được approve access, fallback sang `gpt-4o-mini` qua OpenAI API.
3. **Accent cho pronunciation:** default `en-US` hay cho user chọn?
4. **Chiến lược backup DB**: daily snapshot đủ chưa, có cần point-in-time không?
5. **Admin auth:** cùng table `User` với `role=ADMIN` hay tách bảng riêng? → khuyến nghị cùng table cho MVP.

---

## 12. Definition of Done cho MVP

Tính năng được xem là "Done" khi thỏa **tất cả**:

- Có test e2e (Playwright) cho happy path.
- Có unit test cho service logic (coverage ≥ 60%).
- UI responsive desktop ≥ 1280px, không vỡ.
- Có loading + error state rõ ràng.
- Có log + request id trace được.
- Đã pass code review.
- Deployed lên môi trường staging và QA manual.

---

## Appendix A – Thư viện tham khảo

- `microsoft-cognitiveservices-speech-sdk` – Azure Speech browser SDK.
- `react-youtube` – YouTube IFrame wrapper.
- `subsrt-ts` – parse SRT/VTT.
- `next-intl`, `next-themes`.
- `@tanstack/react-query`.
- `zod` + `@hookform/resolvers` cho form.
- `lucide-react` icons.

## Appendix B – Tham khảo docs

- Azure Pronunciation Assessment: [https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment)
- Azure Speech Token: [https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short](https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short)
- Next.js App Router i18n: [https://next-intl.dev/docs/getting-started/app-router](https://next-intl.dev/docs/getting-started/app-router)

