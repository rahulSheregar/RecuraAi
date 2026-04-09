# RecuraAi — take-home submission

I interpreted the assignment as a **narrow vertical product** instead of a generic “automation builder” UI: an **AI-assisted dental scheduling assistant** where **workflows are real executions** (persisted runs and steps), not a disconnected chat box.

**Triggers (two):** (1) **Chat** — user sends a message. (2) **Voice** — user uploads audio; it is transcribed, then the same scheduling pipeline runs on the transcript.

**Workflow definition:** Steps are **defined in code** (queued → transcribe on voice → extract intent via model → decide/book or reply). I did not build a drag-and-drop workflow designer; that would have eaten the whole budget. The important part for me was **end-to-end execution with inspectable history**, which matches how I’d ship an MVP before investing in a visual editor.

---

## Setup

**Prerequisites:** Node 20+ (LTS is fine), npm.

```bash
git clone <your-repo-url>
cd RecuraAi
npm install
```

Create `.env.local` in the project root with an OpenAI key (required for intent extraction and voice transcription):

```
OPENAI_API_KEY=sk-...
```

Optional: `OPENAI_MODEL` and `OPENAI_AUDIO_MODEL` override defaults.

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`. SQLite data lives under `data/` (created on first run).

**Build check (optional):**

```bash
npm run build && npm start
```

---

## How to “define → trigger → watch” (what graders can do)

1. **Define** in this MVP means: the app ships with a **fixed** workflow (steps above). Doctor profiles and prompts are configurable in the UI, but the **graph** is code-defined.

2. **Fire a trigger:**  
   - **Chat:** use the Chat tab and send a scheduling message.  
   - **Voice:** use the Audio tab, upload a file, process it.

3. **Watch execution:** open **Workflow status** from the dock. Expand a run to see each step, timestamps, and JSON inputs/outputs. Voice jobs show transcribe and chat steps on the **same run id** so the timeline matches the pipeline.

There is also a **Backtesting** screen that runs **deterministic** checks (scheduling policy + intent normalization) without calling OpenAI — useful for regression, not a substitute for manual runs.

---

## Key decisions

- **Same engine for voice and text after transcription** — Voice creates a run early (including transcribe steps), then `/api/chat` **continues** that run instead of opening a second one. That was the main integration fix for “one workflow, two triggers.”

- **Modular executor** — Scheduling and intent **prompt construction** live outside the route handler so the HTTP layer stays thin and the policy is testable.

- **SQLite + Drizzle** — Enough for a local demo; no hosted DB requirement.

- **Stubbed bookings** — Successful books write to a simple appointments table; there is no external calendar or EHR.

- **API key in Settings** — Lets you demo without committing secrets; server still prefers `OPENAI_API_KEY` when set.

---

## Tradeoffs

- **Code-defined workflows vs visual builder:** Faster to ship a believable execution path and history. A real builder would need versioning, validation, and migration — out of scope for ~6 hours.

- **Two strong triggers instead of many:** Chat + voice cover “text in” and “audio in” without pretending to support webhooks, cron, or arbitrary event sources.

- **Intent model does heavy lifting** — The “AI action” is **structured intent extraction** feeding deterministic scheduling rules. That keeps booking logic testable; the model is not allowed to invent calendar state.

- **Doctor data** — Profiles are primarily **local persistence** for the demo; the scheduling engine reads them the same way whether they came from seed data or the UI.

---

## Stubs and known gaps

- **No production auth, HIPAA, or multi-tenant isolation** — Single-user local app.

- **Voice is upload-only** — No Twilio or live phone ingest; “voicemail” is simulated by file upload.

- **Cancel/reschedule** — Extracted intents exist, but the product mostly **books or suggests slots**; full cancel flows are not implemented as first-class calendar operations.

- **“Reply with option number”** — Alternatives are listed; **choosing by number in a follow-up message** is not fully wired as a structured follow-up booking — acceptable gap for the demo.

- **Timezone** — Uses the server/runtime local behavior where relevant; not hardened for multi-region clinics.

- **README constraint** — I’m not pasting a folder tree here on purpose; explore the repo in your IDE or the walkthrough video.

---

## AI in the workflow

The meaningful AI step is **intent extraction** (JSON: scope, intent, doctor hint, requested times) from the user message, which downstream code uses to accept, decline off-topic requests, book a stub slot, or offer alternatives. Without that step, the workflow would be a static script.

---

## Video (for submission)

Record a short Loom (under 5 minutes) covering architecture, data model for runs/steps/appointments, how the main flows connect, and what I’d change for a production team codebase (auth, idempotency, real calendar, richer failure/retry, workflow versioning).
