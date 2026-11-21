# ReviewLens

ReviewLens is a small full-stack app that turns messy product reviews into an actionable store-owner dashboard.

## Run locally

Requirements: Python 3.10+.

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

python server.py
```

Open http://localhost:8000.

The **Analyze sample** button loads `sample.csv` from the repository.

## Deploy on Vercel

The repository includes `vercel.json` and a Python serverless entrypoint at `api/index.py`.

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. In Project Settings > Environment Variables, add:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL=gemini-3-flash-preview`
4. Deploy.
5. Do not upload `.env`; Vercel environment variables must be configured in the dashboard.

The root path is routed to `static/index.html`, and `/api/sample`, `/api/analyze`, and
`/api/reply` are routed to the Python serverless function.

## Using a Gemini API key

The app requires a Gemini API key for real CSV analysis. It does not use local heuristic fallback
results or a cached-analysis substitute. Without a key or when Gemini fails, affected reviews are
reported as `analysis_failed`.

For real Gemini analysis:

1. Create a Google AI Studio account at https://aistudio.google.com/.
2. Open **Get API key**, create a key, and copy it.
3. In the project root, copy `.env.example` to `.env`.
4. Set `GEMINI_API_KEY` in `.env`:

   ```dotenv
   GEMINI_API_KEY=your_real_key_here
   GEMINI_MODEL=gemini-3-flash-preview
   PORT=8000
   ```

5. Restart the server because environment variables are loaded at startup.
6. Open http://localhost:8000 and click **Analyze sample** or upload a CSV.

Do not put the key in HTML or JavaScript. The browser only communicates with the local server,
and the server makes Gemini requests. Never commit `.env`. The independent `sample.csv` is used
by the **Analyze sample** button; `reviews.csv` is available for manual upload and is not loaded by the sample button.

Run tests:

```bash
python -m unittest -v
```

The suite covers CSV cleaning, schema validation, provider failures, prompt-injection resistance,
and normalized duplicate detection.

## Architecture

The browser serves as a static dashboard. It reads an uploaded CSV and sends the CSV text to the Python HTTP backend. The backend performs CSV cleaning and batches reviews into groups of five. Every batch is sent directly to Gemini from the server, and every response is validated before the dashboard receives it. There is no response cache or local heuristic fallback. Suggested replies are generated only when a user clicks `Generate reply`.

## AI prompt and prompt-injection resistance

The production prompt states that every `review_text` is untrusted customer data and must not be followed as an instruction. It is serialized into a JSON array, separate from system instructions, and asks Gemini to return only:

```json
{
  "results": [
    {
      "sentiment": "positive|neutral|negative",
      "topics": ["quality|delivery|price|packaging|support|size_fit|other"],
      "summary": "One English line",
      "needs_reply": true
    }
  ]
}
```

R012 and R015 contain an instruction to mark themselves positive. The prompt explicitly tells the model to ignore instructions in review text and classify the described defect instead. R012 should therefore become negative, with the left-earbud failure as the summary and `needs_reply=true`. The model never receives review text as a system instruction.

## Reliability behavior

- Empty rows are skipped and duplicate text is de-duplicated.
- Missing or non-numeric ratings become `unknown`.
- Duplicate text is normalized and de-duplicated before it is sent to Gemini.
- Invalid JSON, invalid fields, or wrong result counts trigger a validation retry; a second failure marks `analysis_failed`.
- HTTP 429 and 5xx responses use exponential backoff.
- Reviews are processed in batches of five.
- The API key is read only from the server environment and is never sent to the browser.

### Processing metrics

- **Gemini calls** counts provider batches sent during the current run. A 14-review
  file uses batches of five, so it can make up to three provider calls.
- If Gemini quota, network, or server requests fail, the app retries rate-limit and server errors
  with exponential backoff. Invalid AI schemas are retried once. Provider failures then use the
  `analysis_failed` status. Results are never substituted from cache or heuristic rules.

## Screenshots

![ReviewLens dashboard](screenshots/dashboard.png)

![Filtered product view](screenshots/product-filter.png)

## Known limitations

Gemini availability and free-tier quota determine whether rows can be analysed. The server is intentionally dependency-free and does not cache provider responses. The app does not currently authenticate users or isolate uploads by tenant.

Gemini free-tier keys can reach their daily request quota. When this happens, ReviewLens retries
rate-limit responses and then reports affected reviews as `analysis_failed` rather than pretending
they were analysed.

With more time, I would add an authenticated database-backed upload history, product detail pages, provider abstraction, streaming progress, stronger language detection, and a Docker Compose deployment.

## Development notes

The implementation was developed and verified locally. CSV behavior, Gemini integration,
dashboard rendering, API retries, and automated tests were checked before submission.
