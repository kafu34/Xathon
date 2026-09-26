# Pace

Pace is a mobile-first Singapore student health-coaching hackathon prototype. It combines a student's **confirmed timetable**, goals and health check-ins to suggest a small plan that fits around fixed classes, exams and shifts. The six conceptual roles are Profile, Health, Pattern, Planner, Coach and Learning.

## Run locally

```sh
node preview-server.js
```

Open `http://127.0.0.1:4173`. The app has no package dependencies. All browser files are in `dist/`.

## What works

- Student onboarding with age, school, height, optional weight and health context, lifestyle, ranked goals, routine and sleep schedule.
- A clearly labeled Alex demo scenario with sample tracker history and a university timetable.
- Timetable screenshot upload with browser OCR, editable extraction preview, manual correction and confirmation before planning.
- A plan for today and the next three days that keeps classes, exams and shifts fixed.
- Daily check-ins for sleep, energy, stress, steps, activity, workout type, feeling and optional heart rate.
- Trend graphs for sleep, activity, steps, resting HR, stress, weight and plan follow-through.
- A demo coach chat that explains recommendations, responds to all-nighter constraints, can move workout timing and can apply an unambiguous one-day class change.
- Exam and other temporary modes that pause learning or create a separate baseline, with prior history retained.
- Evidence panels linking to HealthHub Singapore and Singapore Physical Activity Guidelines.
- Approved plan-item reminder export as an `.ics` file for Google Calendar import.
- A static sponsored-event placeholder that does not target health data.
- Responsive home, trends, timetable, four-day plan, coach and settings screens.

Data is saved in the current browser's `localStorage`. The first screen offers local setup, an Alex demo, or a sample dashboard. See [architecture](docs/architecture.md) and the [proposed database schema](docs/schema.sql).

## Current limits

This is a prototype. It does **not** have real account login, cloud storage, live fitness device sync, a model-backed LLM, or Google OAuth/API sync. Timetable OCR uses Tesseract.js loaded from a CDN when an image is selected; review and confirmation are required. The readiness estimate and coach responses use transparent demo rules, are not clinically validated and are not medical advice. The device dialog requests no permissions. Calendar reminders are exported as a file, not automatically added to a Google account.

## Credentials

No access keys are required to run the current app. `.env.example` lists placeholders for future server integrations. **Do not commit real API keys, OAuth client secrets, or wearable tokens to this repository.** Store them in GitHub repository secrets or the deployment provider's secret manager, and use them only from a backend. A browser app cannot keep a secret key private.

The `.openai/hosting.json` file contains a Sites project identifier and static output setting, not an access token.
