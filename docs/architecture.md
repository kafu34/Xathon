# Pace architecture

Pace is a mobile-first website for a Singapore polytechnic or university hackathon demo. Its core decision is to keep fixed timetable events fixed and place small health suggestions in the gaps. The browser keeps the user's profile and history locally; an opt-in Cloudflare Worker calls GroqCloud's chat completions API for model analysis and chat. `dist/services.js` contains timetable-safe planning modules, `dist/student.js` contains student flows, `dist/ai.js` handles opt-in AI UI, and `worker/index.js` implements the model gateway. `scripts/build-worker.mjs` bundles the UI and Worker into `dist/server/index.js` for Sites.

## Current flow

```text
Student profile + ranked goals + confirmed timetable + normalized health entries
  → Profile Agent (goals, conditions, injury, routine, temporary context)
  → Health Agent (available sleep, activity, HR, steps, stress)
  → Pattern Agent (observations from this user's labelled history)
  → Planner Agent (today + next 3 days around fixed events)
  → numeric short-horizon forecast from labelled personal data
  → LLM analysis / Coach Agent (structured output, timetable validation, evidence links)
  → Student action / tracker demonstration
  → Learning Agent (completion history informs future duration)
  ↺ Pattern Agent
```

These are software modules, not six separate large language models. One general LLM explains forecasts and replies to chat; structured personal data and the validated planner remain separate. The Worker accepts only selected fields, computes descriptive three-day ranges when at least four observations span three days, and asks the LLM to interpret those ranges. It uses GroqCloud strict JSON schema mode, capped output, a server-held key, and a fixed source list. It rejects model-selected plan items that overlap fixed commitments and replaces unsafe medical or timetable-changing claims. No clinical accuracy or disease-risk prediction is claimed. The model is unavailable until the Site secret `GROQ_API_KEY` is configured.

## Normalized tracker record

`trackerAdapter.normalize(raw, provider)` maps manual entries, sample data, and future providers to one shape. Missing values remain `null` rather than being treated as zero.

```json
{
  "timestamp": "2026-09-26T12:00:00+08:00",
  "source": "manual | demo | apple_health | fitbit | garmin | samsung_health | oura | whoop | health_connect | other",
  "sleep_duration": 6.2,
  "sleep_start": null,
  "sleep_end": null,
  "resting_heart_rate": 72,
  "average_heart_rate": null,
  "steps": 4800,
  "active_minutes": 10,
  "workouts": [],
  "calories_burned": null,
  "recovery_score": null,
  "hrv_if_available": null
}
```

Provider adapters should map units, timestamps and provenance before analysis. Missing device data must not be inferred as normal behaviour. A connected provider would use its own OAuth consent flow and server-held tokens. The current tracker picker requests no permissions and the sample records are marked as demo data.

## Timetable flow

1. The student uploads a screenshot. Tesseract.js runs OCR in the browser.
2. Parsed day/time/title rows are shown in editable fields. A student can also add or remove rows manually.
3. Only **confirmed** rows become fixed schedule constraints.
4. A new upload replaces the confirmed timetable after another review. An exam timetable can be marked temporary; the prior regular schedule is retained for restoration.
5. A specific class change in chat becomes a dated override, so a one-off change does not silently change the weekly timetable.

OCR on grid screenshots may be imperfect; the review step is mandatory. The uploaded image is previewed locally and is not saved in the prototype. The OCR library and language assets are fetched from a CDN when needed.

## Planning and safety

- Suggestions occupy free time after or between fixed events. Classes, exams and shifts remain fixed.
- The planner covers today and the next three days, uses lower effort when sleep/stress or temporary context warrants it, and offers general rest guidance when an injury or condition is reported.
- Temporary periods are labelled. The student may pause baseline learning or build a separate temporary baseline; ending a period restores the regular baseline.
- Personal pattern text is labelled as an observation, not causation. The readiness number is a demo heuristic, not a disease-risk score.
- The student must opt in before selected health and timetable context is sent to the Worker and GroqCloud. Switching providers invalidates prior consent. Name, school, height and weight are excluded from model requests. The Worker keeps no account history. GroqCloud's data controls are linked in the consent screen. The public hackathon endpoint has input bounds, a same-origin check and a best-effort in-memory request cap; production needs authentication and durable rate limiting.
- Health advice links to HealthHub Singapore, Health Promotion Board and SportSG sources. The app does not diagnose, prescribe, change medication, or override a clinician.
- Sponsored placements are static demo cards and do not inspect conditions, heart rate or other sensitive health data.

## Calendar and feedback

Approved plan items can be exported as an `.ics` calendar file. The Google Calendar switch is a demo preference and does not claim live OAuth sync. A future CalendarService would exchange a user-approved OAuth grant on the backend and create only approved events. The Learning Agent stores completions and prefers durations the student actually finishes. A demo tracker-detection control illustrates automatic completion; no real wearable is connected.

## Production migration path

The prototype stores one local profile in `localStorage` and does not provide real authentication. A production version should use Expo/React Native for the mobile client, Supabase Auth and PostgreSQL with per-user row-level security (see `schema.sql`), durable API rate limits, provider-specific tracker adapters, and Google OAuth. Keep API keys, OAuth client secrets, provider refresh tokens and health data out of public source files and client bundles. Store secrets in the deployment secret manager. Only one person's health context may be used in any account request.
