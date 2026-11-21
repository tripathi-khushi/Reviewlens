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

## Using a Gemini API key

The app works without an API key using a local heuristic fallback, so CSV analysis and the dashboard
are available immediately. The fallback is not an LLM: it uses local keyword and sentiment rules,
should not be treated as production-grade AI, and does not count as an AI call.

For real Gemini analysis:

1. Create a Google AI Studio account at https://aistudio.google.com/.
2. Open **Get API key**, create a key, and copy it.
3. In the project root, copy `.env.example` to `.env`.
4. Set `GEMINI_API_KEY` in `.env`:

   ```dotenv
   GEMINI_API_KEY=your_real_key_here
   GEMINI_MODEL=gemini-2.5-flash
   PORT=8000
   ```

5. Restart the server because environment variables are loaded at startup.
6. Open http://localhost:8000 and click **Analyze sample** or upload a CSV.

Do not put the key in HTML or JavaScript. The browser only communicates with the local server,
and the server makes Gemini requests. Never commit `.env`.

No third-party package installation is required. The app includes the sample `reviews.csv`, and no API key is needed to try the deterministic demo analysis. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to use Gemini:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=8000
```

Run tests:

```bash
python -m unittest -v
```

The suite covers CSV cleaning, schema validation, retry failures, prompt-injection resistance,
and normalized cache hashing.

## Architecture

The browser serves as a static dashboard. It reads an uploaded CSV and sends the CSV text to the Python HTTP backend. The backend performs CSV cleaning, hashes normalized review text, checks `cache.json`, batches uncached reviews into groups of five, and calls Gemini only from the server. Gemini results are validated before the dashboard receives them. Suggested replies are generated only when a user clicks `Generate reply`.

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
- Duplicate text is normalized and hashed, and valid results are cached in `cache.json`.
- Invalid JSON, invalid fields, or wrong result counts trigger a validation retry; a second failure marks `analysis_failed`.
- HTTP 429 and 5xx responses use exponential backoff.
- Reviews are processed in batches of five.
- The API key is read only from the server environment and is never sent to the browser.

## Screenshots

![ReviewLens dashboard](screenshots/dashboard.png)

![Filtered product view](screenshots/product-filter.png)

## Known limitations

The demo fallback is a heuristic and should not replace the configured Gemini analysis. The server is intentionally dependency-free and stores one local JSON cache rather than providing multi-user database isolation. Gemini and network availability can change output timing and cost. The app does not currently authenticate users or isolate uploads by tenant.

With more time, I would add an authenticated database-backed upload history, product detail pages, provider abstraction, streaming progress, stronger language detection, and a Docker Compose deployment.

## AI coding tools

I used GitHub Copilot/Coding Agent for initial scaffolding, implementation review, and test generation. I verified the code, CSV behavior, and retry paths locally and understand the submitted implementation.
