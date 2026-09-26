# Pace

Pace is a mobile-first Singapore student health-coaching hackathon prototype. It combines a student's **confirmed timetable**, goals and health check-ins to suggest a small plan that fits around fixed classes, exams and shifts. The six conceptual roles are Profile, Health, Pattern, Planner, Coach and Learning.

## Run locally

```sh
node scripts/build-worker.mjs
node preview-server.js
```

Run `node scripts/build-worker.mjs` before `node preview-server.js`, then open `http://127.0.0.1:4173`. The preview uses the same bundled Worker as Sites. Add `GROQ_API_KEY` to an ignored `.env.groq.local` and run `node --env-file=.env.groq.local preview-server.js` to test live AI locally; without it, the app clearly reports that live AI is unavailable. No package dependencies are needed.

## What works

- Student onboarding with age, school, height, optional weight and health context, lifestyle, ranked goals, routine and sleep schedule.
- A clearly labeled Alex demo scenario with sample tracker history and a university timetable.
- Timetable screenshot upload with browser OCR, editable extraction preview, manual correction and confirmation before planning.
- A plan for today and the next three days that keeps classes, exams and shifts fixed.
- Daily check-ins for sleep, energy, stress, steps, activity, workout type, feeling and optional heart rate.
- Trend graphs for sleep, activity, steps, resting HR, stress, weight and plan follow-through.
- A demo coach chat that explains recommendations, responds to all-nighter constraints, can move workout timing and can apply an unambiguous one-day class change.
- An opt-in GroqCloud-backed coach chatbot and model analysis using GPT-OSS. The server computes short-horizon trend ranges from personal check-ins, then the LLM explains them and chooses among timetable-safe plan items. Server validation rejects choices that overlap fixed commitments.
- Exam and other temporary modes that pause learning or create a separate baseline, with prior history retained.
- Evidence panels linking to HealthHub Singapore and Singapore Physical Activity Guidelines.
- Approved plan-item reminder export as an `.ics` file for Google Calendar import.
- A static sponsored-event placeholder that does not target health data.
- Responsive home, trends, timetable, four-day plan, coach and settings screens.

Data is saved in the current browser's `localStorage`. The first screen offers local setup, an Alex demo, or a sample dashboard. See [architecture](docs/architecture.md) and the [proposed database schema](docs/schema.sql).

## Current limits

This is a prototype. It does **not** have real account login, cloud storage, live fitness device sync, or Google OAuth/API sync. Timetable OCR uses Tesseract.js loaded from a CDN when an image is selected; review and confirmation are required. The readiness estimate and personal trend ranges are not clinically validated and are not medical advice. The app asks for fresh GroqCloud consent before selected context is sent. The model is available only after `GROQ_API_KEY` is configured as a server secret. There is no medical diagnosis or disease-risk prediction. The device dialog requests no permissions. Calendar reminders are exported as a file, not automatically added to a Google account.

The AI endpoints have a basic same-origin check, input limits, and a best-effort per-IP request cap for the hackathon demo. They are not a substitute for account authentication and production rate limiting. A public deployment with an API key should use a provider-side spend limit until those controls are added.

## Credentials

`.env.example` lists placeholders. Create a key in the [GroqCloud console](https://console.groq.com/keys) for local testing. **Do not commit real API keys, OAuth client secrets, or wearable tokens to this repository.** Store `GROQ_API_KEY` in the Sites secret manager and use it only in the Worker. A browser app cannot keep a secret key private. Review [GroqCloud's data controls](https://console.groq.com/docs/your-data), including Zero Data Retention, before testing with personal health data; the Alex demo uses sample measurements.

The `.openai/hosting.json` file contains only a Sites project identifier, not an access token.
