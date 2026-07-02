# Google AI Studio (Gemini API) Setup Guide

Follow these steps to obtain a free Gemini API key from Google AI Studio and connect it to **Vaitsk** to enable advanced semantic task extraction.

---

## 🔑 Step 1: Generate a Gemini API Key
1. Go to the [Google AI Studio Console](https://aistudio.google.com/).
2. Sign in with your standard Google (Gmail) or Google Workspace account.
3. Click on the blue **Get API key** button in the top left sidebar (or center page).
4. Click **Create API key**.
5. Select either:
   * **Create API key in new project** (recommended, generates a standalone Google Cloud project automatically).
   * **Create API key in existing project** (maps it to an existing Google Cloud console project).
6. Copy the generated API key string (looks like `AIzaSy...`).

---

## ⚙️ Step 2: Configure Environment Variables
Now, add this key to your local Next.js project to activate the backend LLM handler:

1. Open the `.env.local` file in the root folder of your project workspace (or create it if it doesn't exist).
2. Paste the API key into the `GEMINI_API_KEY` parameter:

```env
# =========================================================================
# Google Gemini API Key
# =========================================================================
GEMINI_API_KEY=paste_your_copied_api_key_here
```

---

## ⚡ Step 3: Run & Verify LLM Extraction
1. Restart your local Next.js development server to load the new `.env.local` variable:
   ```bash
   # Stop with Ctrl+C, then restart:
   npm run dev
   ```
2. Open the page [http://localhost:3000](http://localhost:3000).
3. Type or speak a sentence, such as:
   * `Rahul will compile the authentication module tomorrow. Sarah is blocked on database login credentials.`
4. Click **Commit Suggestions to DB**.
5. Inspect your terminal logs. The console logs will no longer show the fallback message:
   `No GEMINI_API_KEY found, falling back to local rule-based extractor`
   Instead, the Next.js API route [/api/extract](file:///Users/apple/Web%20App%20Projects/vaitsk/src/app/api/extract/route.ts) will query the live `gemini-1.5-flash` model, yielding advanced context, tags, and priorities!
