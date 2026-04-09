# Project AI context — RecuraAi

Use this document so coding agents align with **product intent**, **assignment requirements**, and **architecture direction**. It is **not** the candidate README (that must be human-written for submission).

---

## One-line product

**AI-powered dental appointment scheduler** for clinics: inbound **voicemail (simulated via upload)** and **web chat** feed the **same workflow engine** to resolve scheduling intent, stay in dental scope, and **book (stubbed calendar)** or return an appropriate message.

---

## Take-home assignment (what graders verify)

Non-negotiables:

- Users **define** workflows: at least **one trigger** and **one or more actions**.
- Workflows **actually execute** locally: define → fire trigger → **watch actions run**.
- **One action type is AI-powered** and **meaningful in the chain** (e.g. triage, extract structured intent, draft patient reply)—not only a disconnected chat widget.
- **Execution status or history** is visible (per run, per step).

Good patterns to demonstrate: **separation of concerns**, modular executor, clear data model for runs/steps, validation and failure handling where it matters.

---

## Product interpretation (narrow scope)

### Two user interfaces (two triggers, one engine)

1. **Voice upload (voicemail simulation)**  
   - **Copy for UI:** In production this would attach to the clinic’s voicemail pipeline; **for the project**, users **upload one or more audio files** to start the same pipeline.  
   - **Behavior:** Submitting uploads starts **async workflow processing** (transcribe → downstream steps).

2. **Chat with AI assistant**  
   - **Goal:** Resolve **appointment-related** concerns in scope.  
   - **Behavior:** Messages start or continue resolution; **same core pipeline as voice** once text exists (transcript vs chat text).

### Resolver behavior (examples)

- **Off-topic / non-dental** (e.g. “my stomach hurts”): polite boundary; **no booking**; workflow completes with a clear outcome (e.g. `declined_off_topic`).
- **In-scope scheduling** (e.g. “appointment with Dr. Rahul next Monday”): **extract** doctor + time → **check availability** (stub) → **book** if free, else **propose next available** slots in the reply.

Keep the **case matrix small** for MVP; document extras as out of scope in the human README.

### Status / history (first-class UX)

Expose granular states, e.g.: queued → transcribing (voice) → AI triage → AI extract intent → check availability → book or reply → completed/failed.  
Each **workflow run** should be inspectable (timeline + timestamps + short detail).

---

## Target architecture (direction of travel)

Conceptual layers (implement as the codebase matures):

| Layer | Responsibility |
|--------|----------------|
| **Workflow definition** | Ordered steps (types + config); can be code-defined for MVP. |
| **Triggers** | `voice_batch_submitted`, `chat_message` (or equivalent)—both enqueue/create a **run**. |
| **Executor** | Runs steps sequentially (or defined DAG later); updates **step status**; handles failures per your README policy. |
| **AI actions** | Steps that call the model with **prior step outputs**; return structured JSON when possible for booking logic. |
| **Integrations (stubbed)** | Calendar / doctor availability as **in-repo data** or simple API; no real EHR/phone in MVP. |
| **Persistence** | `WorkflowRun`, `WorkflowStepRun`, optional `Appointment`, optional `ChatThread`/`Message`. |

**Anti-pattern to avoid:** Chat that only calls OpenAI with **no** workflow run, **no** step log, and **no** shared executor with voice—that **fails** the assignment narrative.

---

## Current stack (this repo)

- **Next.js** (App Router), **TypeScript**, **Tailwind**, **shadcn-style UI** (Base UI primitives in places).
- Existing surfaces: home (audio + chat tabs), calendar, doctor profiles (localStorage), settings (session API key + prompts in localStorage), `/api/chat` for OpenAI.

**Integration note:** New workflow engine should **reuse** settings for API key / prompts where appropriate, or document a dedicated workflow system prompt.

---

## Conventions for agents

- Prefer **small, focused changes**; match existing file patterns and naming.
- Do **not** replace or ghost-write the **submission README**; candidates write that themselves.
- When adding workflow features: **persistence + executor + visible run history** should move together; don’t ship invisible background-only execution.
- Document **stubs** (calendar, telephony, HIPAA, auth) in code comments briefly and in the human README in detail.

---

## Glossary

- **Run:** One execution of a workflow from a trigger to completion/failure.  
- **Step:** A single unit in the chain (transcribe, triage AI, book, etc.).  
- **Trigger:** The event that creates a run (upload submit, chat send, etc.).
