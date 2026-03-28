# Sentiment Analysis MVP

A MongoDB-backed full-stack web app built from the original notebook workflow in [Sentimenatal_anaylsis.py](C:/Users/Public/Documents/LANGUAGE/final-project-S_A-28-March/Sentimenatal_anaylsis.py), now with Better Auth email/password authentication.

## Stack

- React + Vite frontend
- Express backend
- MongoDB + Mongoose for run storage
- Better Auth for email/password authentication
- Node-based sentiment pipeline with a fallback analyzer

## Features

- Upload a CSV file
- Public landing page with sign-in and sign-up
- Email/password authentication
- Auto-detect the likely review text column
- Manually override the selected text column
- Choose a product category for aspect extraction
- Run sentiment analysis across the dataset
- View a richer results dashboard with:
  - sentiment distribution
  - sentiment by aspect
  - top aspects
  - aspect coverage
  - review length by sentiment
  - keyword breakdown
  - word cloud
  - analyzed rows
- Reopen previous runs from local history
- Export the enriched CSV
- Scope runs to the signed-in user only
- Inspect run details:
  - detected column
  - used column
  - total rows
  - rows analyzed
  - rows removed
  - model mode
  - model name

## Project Structure

```text
client/        React frontend
server/        Express API, MongoDB connection, and analysis logic
data/          Old local run artifacts from the pre-Mongo version
tests/         Utility tests
```

## Install

From the project root:

```powershell
npm install
```

## Environment Setup

Create a `.env` file in the project root and add:

```text
MONGODB_URI=your-mongodb-connection-string
PORT=3001
BETTER_AUTH_SECRET=replace-with-a-32-character-secret
BETTER_AUTH_URL=http://localhost:5173
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3001
```

Use [.env.example](C:/Users/Public/Documents/LANGUAGE/final-project-S_A-28-March/.env.example) as the template.

`mongodb.txt` can remain as a temporary reference, but the app now reads the connection string from `MONGODB_URI`.

`BETTER_AUTH_SECRET` is required for session security.

`BETTER_AUTH_URL` should point to the browser-facing app URL in development.

`BETTER_AUTH_TRUSTED_ORIGINS` should include any additional allowed origins that talk to the auth server directly.

## Run In Development

```powershell
npm run dev
```

This starts:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:3001](http://localhost:3001)

## How To Use

1. Open [http://localhost:5173](http://localhost:5173)
2. Create an account or sign in
3. Enter the private app workspace
4. Upload a CSV file
5. Confirm or change the detected review column
6. Choose a category
7. Click `Run analysis`
8. Review the results screen
9. Export the analyzed CSV if needed

## Results Dashboard

Completed runs now include a richer analysis workspace.

The dashboard includes:

- sentiment distribution
- sentiment by aspect
- top aspects
- aspect coverage overview
- review length by sentiment
- keyword breakdown for positive vs negative terms
- word cloud with sentiment focus switcher
- searchable row table

The word cloud supports:

- `Negative`
- `Positive`
- `Neutral`
- `All`

## Better Auth Integration

The app now includes:

- public landing page
- sign-up page
- sign-in page
- protected private app at `/app/*`
- user-scoped analysis runs
- Better Auth mounted on `/api/auth/*`

Protected API routes:

- `/api/config`
- `/api/runs`
- `/api/runs/:id`
- `/api/runs/:id/export`

Run ownership:

- every new run is stored with the signed-in user id
- users can only see their own history, results, and exports

## Sample CSV

```csv
Review
I love the fit and comfort of this shirt
The quality is poor and the price is too high
Nice style, but delivery was slow
```

## What Gets Added To The Output

The exported CSV includes the original row plus:

- `original_text`
- `clean_text`
- `predicted_label`
- `confidence`
- `aspects`
- `aspect_count`

## Logs And Verification

When you run an analysis, the backend prints logs in the terminal such as:

```text
[run:start] user=... file="reviews.csv" category=CLOTHING detectedColumn="Review" selectedColumn="Review" totalRows=120
[run:complete] user=... id=... validRows=112 removedRows=8 modelMode=transformers modelName=Xenova/distilbert-base-uncased-finetuned-sst-2-english aspectCoverage=54.5%
```

These logs help confirm:

- which column was auto-detected
- which column was actually used
- how many rows were in the CSV
- how many rows were processed
- how many rows were dropped as empty
- whether the model ran in `transformers` or `fallback` mode
- which exact model name was used

You can also verify from the results page, which shows the same run details.

To verify Better Auth itself is mounted correctly, the auth health endpoint should respond from the server:

```text
GET /api/auth/ok
```

Expected response:

```json
{"ok":true}
```

## Testing Checklist

### Auth flow

1. Run `npm run dev`
2. Open [http://localhost:5173](http://localhost:5173)
3. Confirm the public landing page loads
4. Click `Create account`
5. Sign up with:
   - name
   - email
   - password with at least 8 characters
6. Confirm you are redirected into the private app
7. Sign out
8. Sign back in with the same credentials
9. Confirm you return to the private app

### Protected routes

1. While signed out, try opening `/app`
2. Confirm you are redirected to `/sign-in`
3. While signed in, open `/app`
4. Confirm the upload/history/results app works normally

### Run ownership

1. Sign in with account A
2. Upload a CSV and create a run
3. Confirm the run appears in `History`
4. Sign out
5. Create or sign in with account B
6. Confirm account B cannot see account A’s run
7. Confirm account B gets its own separate history after creating a run

### CSV analysis

1. Upload a CSV with a review-like text column
2. Confirm the column is auto-detected
3. Change the selected column manually if needed
4. Run analysis
5. Confirm:
   - sentiment counts render
   - sentiment by aspect chart renders
   - aspect coverage chart renders
   - review length chart renders
   - keyword breakdown chart renders
   - word cloud renders
   - row table renders
   - export works
   - results show model mode and model name

## MongoDB Storage

New runs are stored in MongoDB using Mongoose.

Each run document stores:

- user ownership
- run metadata
- summary stats
- analyzed rows
- model mode
- model name

The app no longer uses local filesystem storage for new runs.

Existing files under `data/` are left untouched and are not auto-imported.

## Better Auth Collections

Better Auth stores authentication data in its own MongoDB collections. The most important ones are:

- `user`
  - stores the main user profile
  - typical fields include:
    - `id`
    - `email`
    - `emailVerified`
    - `name`
    - `image`
    - `createdAt`
    - `updatedAt`
- `account`
  - stores authentication-provider records for a user
  - for email/password login, this is where the password-based account record is tied to the user
  - typical fields include:
    - `providerId`
    - `accountId`
    - `userId`
    - `password`
- `session`
  - stores active login sessions
  - typical fields include:
    - `id`
    - `userId`
    - `token`
    - `expiresAt`
    - `ipAddress`
    - `userAgent`
- `verification`
  - stores verification or token-based auth support records
  - useful for flows such as email verification or password reset in later versions

How these relate to the app:

- Better Auth manages identity in `user`, `account`, `session`, and `verification`
- the app stores analysis data in `runs`
- each run document stores `userId`, which links the analysis run to the Better Auth user

So after sign-up/sign-in and creating a run, you should expect:

- a Better Auth `user` record
- an `account` record
- a `session` record
- a `runs` document with the matching `userId`

## Better Auth Warning About IP Address

You may see this warning in development:

```text
WARN [Better Auth]: Rate limiting skipped: could not determine client IP address. If you're behind a reverse proxy, make sure to configure `trustedProxies` in your auth config.
```

What it means:

- Better Auth tried to apply rate limiting
- it could not determine the client IP for that request
- this often happens in synthetic tests, local development, or when requests do not include proxy/IP headers

Why you may have seen it here:

- the health check was triggered from a manually constructed internal request
- that request did not contain a real browser/client IP

What to expect in normal app usage:

- real browser requests usually provide enough request context
- local dev often still works fine even if this warning appears occasionally

When it matters:

- in production behind a reverse proxy, load balancer, or deployment platform
- if rate limiting must rely on forwarded IP headers

What to do in production:

- configure trusted proxy behavior in your server/deployment setup
- make sure the app receives trusted IP headers such as:
  - `x-forwarded-for`
  - `x-real-ip`
- if needed, extend Better Auth proxy/IP settings further for your deployment environment

## Render Deployment

For Render, use a `Web Service` connected to the `main` branch.

Recommended settings:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

Required Render environment variables:

- `PORT`
- `MONGODB_URI`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL=https://your-app-name.onrender.com`
- `BETTER_AUTH_TRUSTED_ORIGINS=https://your-app-name.onrender.com`

Production notes:

- the server now binds to `0.0.0.0` by default so Render can route traffic to it
- `/api/health` returns a lightweight JSON status payload for Render health checks
- keep `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` aligned with your Render app URL
- large CSV runs may be slower on smaller Render instances because sentiment inference runs on CPU

## Notes

- If the Hugging Face runtime is unavailable, the app falls back to a lightweight rule-based sentiment analyzer.
- Word clouds are included as a supporting exploratory visual.
- Advanced notebook features like WordNet synonym expansion are not included yet.
- Existing local history is not auto-migrated into MongoDB.
- Email verification and password reset are not part of v1 yet.

## Useful Commands

Install dependencies:

```powershell
npm install
```

Start development servers:

```powershell
npm run dev
```

Start backend only:

```powershell
node server\index.js
```

## Current Limitations

- MongoDB connection is required
- Better Auth environment variables are required
- No email verification or password reset yet
- No background job queue
- Existing local runs are not auto-imported
- Frontend build/test execution may depend on your local shell environment

## Async Progress And Cancellation

Run creation is now asynchronous.

What happens when you click `Run analysis`:

1. the server validates the upload and creates a Mongo run document in `queued` state
2. the browser moves to the run page immediately
3. the server processes the run in the background
4. the run page polls Mongo-backed status updates and renders them live

Run lifecycle states:

- `queued`
- `processing`
- `completed`
- `failed`
- `canceled`

Additional run fields now stored in MongoDB:

- `progressPercent`
- `progressStage`
- `progressMessage`
- `errorMessage`
- `cancelRequested`
- `processingStartedAt`
- `processingCompletedAt`
- `lastProcessedAt`
- `progressEvents`

The UI now shows:

- a live progress bar
- the current stage label
- a timeline of stage updates
- a cancel button while the run is active
- status chips in history and on the run page
- lighter active-run polling that returns progress-only payloads while the run is queued or processing

The backend logs now include stage-level progress such as:

```text
[run:queued] user=... id=... totalRows=1230
[run:processing] user=... id=... stage="processing started"
[run:parsing] user=... id=... totalRows=1230
[run:validate] user=... id=... validRows=1230 removedRows=0
[run:inference] user=... id=... processed=320/1230 modelMode=transformers
[run:aspects] user=... id=... processed=800/1230
[run:save] user=... id=... validRows=1230 removedRows=0
[run:complete] user=... id=... validRows=1230 removedRows=0 modelMode=transformers modelName=Xenova/distilbert-base-uncased-finetuned-sst-2-english aspectCoverage=61.7%
```

Cancel behavior:

- users can cancel only `queued` or `processing` runs
- cancellation is cooperative, so the server stops at safe batch/stage boundaries
- a canceled run stays in MongoDB with `status=canceled`
- export is available only for completed runs

## Updated Testing Checklist

### Progress and cancellation

1. Run `npm run dev`
2. Open [http://localhost:5173](http://localhost:5173)
3. Sign in
4. Upload a CSV with enough rows to make progress visible
5. Confirm the run page opens immediately after submit
6. Confirm the progress bar and timeline update while the run is active
7. Confirm the terminal logs show matching stages
8. Click `Cancel run` during `queued` or `processing`
9. Confirm the run ends in `canceled`
10. Confirm export is disabled for the canceled run
11. Start another run and let it complete
12. Confirm export becomes available only after completion

### History live states

1. Open `History`
2. Confirm queued or processing runs show status chips and progress text
3. Wait for a run to finish
4. Confirm the status changes to `completed` without needing a manual browser refresh

### Rich dashboard visuals

1. Open a completed run with enough analyzed rows
2. Confirm the results page shows:
   - sentiment distribution
   - sentiment by aspect
   - top aspects
   - aspect coverage
   - review length by sentiment
   - keyword breakdown
   - word cloud
3. Change the word cloud filter between `Negative`, `Positive`, `Neutral`, and `All`
4. Confirm the word cloud updates correctly
5. Confirm sparse datasets degrade gracefully without breaking the page
