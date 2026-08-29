# VedaAI — Assessment Mapping

A web app where a teacher uploads a **question paper** and **one student's handwritten
answer sheet**, and the app extracts every question, transcribes and maps each answer
to its question, highlights the exact region of the answer sheet for each question, and
produces editable grades and AI feedback.

## Approach

The pipeline is four stages: **Question Extraction → Answer Extraction → Answer Mapping → Grading/Feedback**.

It runs as **two Gemini calls** in the API route (`app/api/map-assessment/route.ts`):

1. **Phase 1 — Question extraction.** The question paper (PDF or image) is sent with a
   schema-constrained prompt that returns every gradable question and sub-question in
   source order, preserving the original numbering. Labelled sub-parts (e.g. `Q2 a)` /
   `Q2 b)`) come back as **separate entries**.
2. **Phase 2 — Answer mapping + grading.** The answer sheet page(s) are sent together
   with the Phase-1 checklist. The model transcribes the whole sheet (a scratchpad
   `transcript` field forces a full read before mapping), then for each question returns:
   the matched answer text, a match `status` (`mapped` / `uncertain` / `not_answered`),
   a confidence, marks + one feedback sentence, and **one or more bounding boxes**
   locating the handwriting.

**Bounding boxes** use Gemini's native `box_2d` format — `[ymin, xmin, ymax, xmax]`
normalized `0–1000`. The server normalizes these to page-percent rectangles
(`lib/assessment-mapping.ts`), dropping malformed / zero-area / out-of-range boxes. The
UI (`app/page.tsx`) draws each rectangle in **real pixels measured from the live rendered
page element** (via `ResizeObserver`), so highlights stay aligned under zoom and resize.

Edge cases handled explicitly:
- **Out-of-order answers** — the model scans all pages per question, not positionally.
- **Multi-page / multi-block answers** — an answer can carry several regions across pages.
- **Unanswered** — `status: "not_answered"` with an empty region set.
- **Answers matching no question** — surfaced in a dedicated **"Unmatched answers"**
  section rather than being silently dropped or force-fit onto a question.

## AI model / API

- **Google Gemini** via the `generativelanguage` REST API (v1beta), structured-output mode.
- **Model: `gemini-2.5-flash`.** This is a **hard constraint, not a convenience choice.**
  The assignment requires a free-tier API, and pro-tier Gemini is **not offered on the
  free tier** — both `gemini-2.5-pro` (retired for new accounts → 404) and its
  replacement `gemini-3.1-pro-preview` return `RESOURCE_EXHAUSTED` with **`limit: 0`** for
  the free tier. Flash is the only model a free-tier key can actually run. (If you attach a
  **billed** key, set `GEMINI_MODEL=gemini-3.1-pro-preview` — the code passes it through
  unchanged.)

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · `pdfjs-dist` (client-side
PDF page rendering) · Poppins (web font). **No auth, no database** — a single
upload/review session is held in React state, which is sufficient per the assignment spec.
Deploys to **Vercel** with a standard `next build`.

## Running locally

```bash
npm install
cp .env.example .env      # then set GEMINI_API_KEY (free key: https://aistudio.google.com/apikey)
npm run dev               # http://localhost:3000
```

Build / production:

```bash
npm run build
npm run start
```

Deploy: push to a Vercel project and set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`)
in the project's environment variables. `maxDuration` for the API route is set to 300s
(Pro tier); typical runs finish in ~35s.

## Assumptions & limitations

Tested end-to-end against **real photographed handwriting** (a phone-photo question paper
with lettered sub-parts + a two-page handwritten answer sheet), not just clean samples.

- **Vertical box drift (~8–10%) on dense handwritten regions.** This is a **model
  limitation, not a rendering bug.** The coordinate-frame conversion and multi-region
  pixel rendering are verified correct (boxes land on the correct page and horizontal
  column with tight widths); the residual error is Gemini mis-estimating the vertical
  position of dense handwriting, and it can't be reduced without a pro-tier model or an
  OCR-grounding pass — neither of which is available under the free-tier constraint.
- **One answer sheet per teacher session.** Matches the assignment spec (one question
  paper + one student's answer sheet). There is no multi-student roster or persistence.
- **Progress bar is determinate for upload, indeterminate for AI analysis.** Upload shows
  real byte progress (XHR upload events); the analysis phase is honestly indeterminate
  because the model gives no mid-analysis progress signal — no fabricated percentage.
- **Client-side image downscaling before upload** (max 1600px longest side, JPEG q0.8;
  PDFs untouched). This keeps requests under Vercel's ~4.5MB body limit and cuts latency.
  Verified on the real test samples to **not degrade** transcription or box accuracy
  (~5.6MB → ~0.6MB total, ~50s → ~36s, box positions within 1–4% of full-resolution).
- **Unmatched-answers section and grading/feedback** go beyond the mock/spec minimum — they
  are intentional scope additions covering the assignment's "may include" grading section
  and the "answers matching no question" edge case.
- **Scanned/opaque PDFs** with no text layer fall back to placeholder questions flagged for
  teacher verification; the native-PDF `<object>` viewer fallback (used only if canvas
  rendering fails) does not draw highlight overlays.
