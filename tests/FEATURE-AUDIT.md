# Pace feature audit — 27 September 2026

## Repaired or completed

| Area | Result |
| --- | --- |
| Data reset | Clears the whole local session, including deleted-entry backups, exam backups, approvals, recovery plans, history, chat and AI consent. Uses an explicit app confirmation. Pending AI results cannot restore an old session. |
| Sample versus personal data | Starting a personal profile clears sample history. Loading Alex over a personal session asks first. New profiles do not inherit the sample resting heart rate. |
| Check-ins | Every measurement is optional. Missing values stay unknown; custom feelings and notes are supported. Historical records can be edited, removed and restored. Records remain sorted, and partial API edits preserve optional fields and period labels. |
| Readiness | Requires today's sleep, energy and stress. Old or incomplete entries do not become a current readiness score. This remains a prototype estimate, not a validated medical metric. |
| Goals | Coach can save a named goal as the main priority or add/remove a goal. Goal priority affects the plan's focus, evidence and health fact. Stress and nutrition goals receive matching optional plan items. |
| Planner | Uses usual profile hours when no timetable has been uploaded, avoids past suggestion windows, and considers missing signals and low energy conservatively. Fixed timetable constraints remain in place. |
| Completion | Per-item completion, skip and undo. Future days cannot be marked complete. Wind-down and meal activities do not train workout duration. Learning uses movement history from the appropriate context and can learn a preferred time after repeated completions. |
| Recovery | Interprets named days and tomorrow; recovery appears as actionable plan items, including days beyond the normal four-day view. It replaces optional suggestions for that date, respects fixed/profile hours, and can be removed. |
| Temporary/health context | Temporary activity feedback is separated from normal learning. A changed health profile starts a new analysis baseline without deleting history. |
| Trends | Exercise days, optional tracker recovery scores and goal follow-through added. Missing days remain blank. Patterns include measured sleep/energy comparisons and recent steps, HR and stress changes. These are observations, not causal conclusions. |
| Reminders | Global toggle controls a visible demo queue. Approved current items export with Singapore timezone and a ten-minute calendar alarm. Completed/skipped items no longer generate exports. |
| Evidence | Viewing a source during onboarding returns to the same form with selections and event handlers preserved. |
| AI | Includes supplied feelings, notes and workout context; serializes chat requests, bounds waiting time, cancels requests when sharing is revoked, and rejects stale responses after state changes. Local guidance and recovery remain available when live AI fails or sharing is declined. |
| Mobile | Timetable inputs reflow so AM/PM values remain readable. Future completion controls are visibly disabled. |

## Coach add-event regression fix

- Coach now saves add-event requests through the timetable code. Missing end times produce a draft and a follow-up prompt or time form, with no false saved confirmation.
- Saved events update the timetable and four-day plan together. Conflicts are rejected, and pending drafts can be cancelled.
- The AI endpoint blocks timetable mutation claims; clients revalidate assets on reload.
- Browser verified the exact report: Wednesday Lab at 3 PM, supply a 4 PM end, then reload. Wednesday retained the 15:00–16:00 lab, two fixed commitments, and a break recalculated to 16:20.

## Verification

- 32 automated tests across `journey.test.mjs`, `timetable.test.mjs` and `worker.test.mjs`.
- Two real Groq requests, using synthetic context: analysis and chatbot both returned successful model responses.
- Browser: complete personal onboarding, evidence round-trip, partial check-in, historical edit/delete/undo, goal change, plan completion, reminder toggle, Thursday all-nighter → Friday recovery, complete reset and reload, and 390px mobile timetable/plan.
- No browser console errors in those exercised flows.

Run deterministic checks with:

```sh
node scripts/build-worker.mjs
node --test tests/timetable.test.mjs tests/journey.test.mjs tests/worker.test.mjs
```

The optional `live-ai-smoke.mjs` uses synthetic data and an existing server-side `GROQ_API_KEY`. Credentials must remain in ignored environment files or hosting secrets.

## Remaining prototype boundaries / incomplete integrations

- **Authentication and cloud account storage:** not implemented. Data belongs to a browser session/origin, not an authenticated account, and does not sync across devices. There is no claim of per-account isolation yet.
- **Wearables:** provider adapters and simulated completion exist; real device authorization and background sync are not connected. Manual and sample data are the supported demo inputs.
- **Google Calendar OAuth:** not connected. The toggle controls a local demo queue; actual calendar delivery requires manual `.ics` import. There are no background push notifications.
- **OCR:** extraction handles recognizable day/time text rows. Image recognition depends on Tesseract and image layout. Arbitrary timetable grids are not guaranteed; review/edit remains required. Real screenshot recognition was not exercised in this audit.
- **AI predictions:** descriptive personal-data trend estimates plus LLM explanations. No proprietary health model was trained or clinically validated during this work. Forecasts are not disease predictions.
- **Chat actions:** supported timetable, movement-time and named-goal changes use constrained parsers. Unsupported or ambiguous changes require the editor; arbitrary LLM-generated actions are not executed.
- **Goal ordering and evidence:** the suggested goal order is a local heuristic. Evidence comes from curated references, not a live literature retrieval service.
- **Persistence:** local browser storage can be cleared by the browser/user. This prototype has no cloud backup, background jobs or push-reminder delivery.

