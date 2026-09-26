# Pace

Pace is an interactive health coaching web app prototype built around six roles: Profile, Health, Pattern, Planner, Coach, and Learning. It combines a user's routine with daily health check-ins to suggest a realistic activity plan.

## Run locally

```sh
node preview-server.js
```

Open `http://127.0.0.1:4173`. The app has no package dependencies. All browser files are in `dist/`.

## What works

- Two-step profile setup for goals, lifestyle, timetable, sleep schedule, and a resting heart rate baseline.
- Daily check-ins for sleep, energy, stress, activity, workout type, and optional heart rate.
- A readiness estimate and activity suggestion that update after each check-in.
- A seven-day chart, check-in history, and personal pattern summary after at least three entries.
- Marking a plan complete, editing profile details, and clearing locally saved data.
- Responsive dashboard, plan, insights, and profile screens.

Data is saved in the current browser's `localStorage`. Before setup, clearly labeled sample data shows what the dashboard can look like.

## Current limits

This is a prototype. It does not have account login, cloud storage, live fitness device sync, or a model-backed AI service. The readiness estimate and suggestions use transparent rules based on entered values; they are not medical advice. The device dialog does not request access or connect to a provider.

## Credentials

No access keys are required to run the current app. `.env.example` lists placeholders for a future server integration. **Do not commit real API keys, OAuth client secrets, or wearable tokens to this repository.** Store them in GitHub repository secrets or the deployment provider's secret manager, and use them only from a backend. A browser app cannot keep a secret key private.

The `.openai/hosting.json` file contains a Sites project identifier and static output setting, not an access token.
