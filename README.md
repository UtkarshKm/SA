# Sentiment Analysis MVP

A local-first full-stack web app built from the original notebook workflow in [Sentimenatal_anaylsis.py](C:/Users/Public/Documents/LANGUAGE/final-project-S_A-28-March/Sentimenatal_anaylsis.py).

## Stack

- React + Vite frontend
- Express backend
- Local filesystem storage for uploaded files and run history
- Node-based sentiment pipeline with a fallback analyzer

## Features

- Upload a CSV file
- Auto-detect the likely review text column
- Manually override the selected text column
- Choose a product category for aspect extraction
- Run sentiment analysis across the dataset
- View sentiment summary, aspect summary, and analyzed rows
- Reopen previous runs from local history
- Export the enriched CSV
- Inspect run details:
  - detected column
  - used column
  - total rows
  - rows analyzed
  - rows removed
  - model mode

## Project Structure

```text
client/        React frontend
server/        Express API and analysis logic
data/          Local run storage
tests/         Utility tests
```

## Install

From the project root:

```powershell
npm install
```

## Run In Development

```powershell
npm run dev
```

This starts:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:3001](http://localhost:3001)

## How To Use

1. Open [http://localhost:5173](http://localhost:5173)
2. Upload a CSV file
3. Confirm or change the detected review column
4. Choose a category
5. Click `Run analysis`
6. Review the results screen
7. Export the analyzed CSV if needed

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
[run:start] file="reviews.csv" category=CLOTHING detectedColumn="Review" selectedColumn="Review" totalRows=120
[run:complete] id=... validRows=112 removedRows=8 modelMode=transformers aspectCoverage=54.5%
```

These logs help confirm:

- which column was auto-detected
- which column was actually used
- how many rows were in the CSV
- how many rows were processed
- how many rows were dropped as empty
- whether the model ran in `transformers` or `fallback` mode

You can also verify from the results page, which shows the same run details.

## Local Storage

Each run is stored locally under:

```text
data/runs/<runId>/
```

Artifacts include:

- original uploaded CSV
- `metadata.json`
- `rows.json`
- `output.csv`

The run history index is stored in:

```text
data/index.json
```

## Notes

- If the Hugging Face runtime is unavailable, the app falls back to a lightweight rule-based sentiment analyzer.
- Advanced notebook features like WordNet synonym expansion and word clouds are not included yet.
- Database integration is intentionally deferred for this MVP.

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

- Local storage only
- No authentication
- No background job queue
- No database yet
- Frontend build/test execution may depend on your local shell environment
