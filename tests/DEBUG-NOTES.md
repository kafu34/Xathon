# Timetable repair verification — 27 September 2026

## Automated checks

Run from the repository root:

```sh
node scripts/build-worker.mjs
node --test tests/timetable.test.mjs tests/worker.test.mjs
```

Covers repeated one-off changes, legacy chained overrides, weekly changes, exact dates, invalid times, midnight boundaries, ambiguous events, clashes, AM/PM OCR text parsing, temporary exam replacement/restoration (including an empty baseline), recovery windows, temporary learning separation, deployed assets and AI endpoint behavior. AI endpoint tests mock the model provider; they do not test live model availability.

## Browser checks

Verified using an isolated localhost origin with Alex sample data:

- Edit an existing lecture; confirm it and see the new time in the four-day plan.
- Reload and verify the saved weekly timetable remains.
- Change the same lecture twice through Coach; only the latest dated occurrence remains.
- Attempt to move it into a lab; see a clash response and no mutation.
- Confirm an exam timetable, end the period in Settings and recover the prior weekly timetable and dated change.
- Cancel an editor change and retain the saved schedule.
- No browser console errors in those flows.

OCR text parsing is covered automatically. Recognition accuracy for arbitrary screenshot layouts still depends on Tesseract and the image; every extracted row requires review. The screenshot recognition service itself was not exercised in this pass. Calendar export remains a manual .ics import, and wearable links remain prototype placeholders.
