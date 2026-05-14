# Audit Apply Note — AIAppointmentSchedulerwithNLP

## Audit recommendations (from batch_00.md)

Substantive: 13 routes, 25 AI endpoints. Comprehensive scheduling AI.

### Missing AI counterparts
- AI optimal time suggestion (calendar + travel time)
- AI cancellation prediction
- AI customer satisfaction scoring

### Missing non-AI features
- Calendar integration (Outlook, Google)
- SMS/email delivery
- Payment collection
- Team collaboration

### Custom feature suggestions
- Calendar integration
- Travel time estimation
- Video conferencing (Zoom/Teams)
- Payment pre-auth
- Cancellation prevention

## Implemented in this pass

None. Substantive project. Remaining items are predominantly external integrations (Google/Outlook/Zoom/Twilio/Stripe) requiring creds.

## Backlog (not implemented)

| Item | Category | Reason |
|---|---|---|
| AI optimal time suggestion (incl. travel) | NEEDS-CREDS | Maps API for travel time |
| AI cancellation prediction | TOO-RISKY | Needs historical cancellation features |
| AI customer satisfaction scoring | NEEDS-PRODUCT-DECISION | Survey or review source |
| Google / Outlook calendar sync | NEEDS-CREDS | OAuth credentials |
| SMS/email delivery | NEEDS-CREDS | Twilio / SendGrid |
| Payment collection | NEEDS-CREDS | Stripe / payment processor |
| Video conferencing | NEEDS-CREDS | Zoom / Teams |

## Apply pass 3 (frontend)

FE already wired. `frontend/src/App.jsx` mounts dedicated AI pages
(`BufferOptimizer`, `NoShowPredictor`, `RescheduleSuggester`,
`ResourceAllocator`, `ConflictResolver`, `AIExtras`, `AIFeatures`),
and `frontend/src/services/api.js` exposes a comprehensive client
calling `/ai/summary`, `/ai/buffer*`, `/ai/noshow*`, `/ai/reschedule*`,
`/ai/resources*`, `/ai/allocations*`, `/ai/conflicts*`, `/ai/extras/*`
with Bearer-token auth via `getHeaders()`. No FE work performed.

## Apply pass 4 (mechanical backlog)

SKIPPED. All remaining backlog items are tagged NEEDS-CREDS
(Google/Outlook/Twilio/SendGrid/Stripe/Zoom), TOO-RISKY (cancellation
prediction needs historical features), or NEEDS-PRODUCT-DECISION
(satisfaction scoring source). No items marked MECHANICAL.

## Apply pass 5 (all backlog)

Implemented 3 backlog endpoints under `/api/ai-extras` (additive, all
gate on `OPENROUTER_API_KEY` -> 503 + `missing: OPENROUTER_API_KEY`):

- `POST /cancellation-predict` MECHANICAL — uses existing appointment +
  contact history. New table `cancellation_predictions`.
- `POST /satisfaction-score` PRODUCT-DECISION — source = post-appointment
  `{rating: 1-5, feedback_text}` (external survey vendor remains
  NEEDS-CREDS). New table `satisfaction_scores`.
- `POST /optimal-time-suggest` PRODUCT-DECISION — LLM-only travel
  estimate via `location_hint` free text (Maps API path remains
  NEEDS-CREDS, `GOOGLE_MAPS_API_KEY`). New table `optimal_time_suggestions`.

FE: `frontend/src/pages/AIExtras.jsx` extended with three new tabs
(Cancel Predict, Satisfaction, Optimal Time). `frontend/src/services/api.js`
extended with three new methods on `aiExtrasApi`.

Files touched:
- `backend/src/controllers/aiBacklogController.js` (new)
- `backend/src/routes/aiBacklog.js` (new)
- `backend/src/server.js` (+2 lines)
- `frontend/src/services/api.js` (+9 lines)
- `frontend/src/pages/AIExtras.jsx` (3 tab defs, 5 state vars, 3 render branches)

Smoke: PostgreSQL boot + login (`demo@scheduler.com / demo123456`) +
`OPENROUTER_API_KEY` blanked produced HTTP 503 + `missing` field for all
three new endpoints. Em-dash bug in `X-Title` header found and fixed
proactively.

Backlog still deferred: Google/Outlook calendar sync, Twilio/SendGrid,
Stripe, Zoom (NEEDS-CREDS).
