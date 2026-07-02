# Setup & Configuration Guide

Follow these steps to configure, run, and deploy the **Vaitsk** voice task extraction and project management companion.

---

## 📋 Prerequisites
Ensure you have the following installed on your machine:
* **Node.js**: v18.x or higher
* **npm**: v9.x or higher

---

## ⚡ Quick Start (No Configuration Required)
Vaitsk is equipped with **zero-setup sandbox environments** for both the database and the task extraction engine. You can run the application immediately out of the box:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local Next.js development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

*Note: In zero-setup mode, the application stores data client-side in your browser's `localStorage` and parses voice input using a local rules-based regex engine ([localExtractor.ts](file:///Users/apple/Web%20App%20Projects/vaitsk/src/lib/localExtractor.ts)).*

---

## ⚙️ Full Configuration (Cloud Sync & LLM Intelligence)

To enable cloud synchronization (Firebase Firestore) and production-grade AI transcript extraction (Google Gemini API), set up your environment variables.

### Step 1: Create Environment File
Create a new file named `.env.local` in the root of the project:
```bash
touch .env.local
```

### Step 2: Fill in the Configuration Keys
Add the following credentials to your `.env.local` file:

```env
# =========================================================================
# 1. Google Gemini API Configuration
# =========================================================================
# Get your API key from Google AI Studio: https://aistudio.google.com
GEMINI_API_KEY=your_gemini_api_key_here

# =========================================================================
# 2. Firebase Client Configuration
# =========================================================================
# Set up a Web App in Firebase Console: https://console.firebase.google.com
# Create a Firestore Database in test mode.
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

Once saved, **restart your development server** (`npm run dev`) so Next.js loads the new environmental parameters. You will see the database indicator badge in the app change from **"Local Sandbox"** to **"Firebase Synced"**!

---

## 📂 Key File Architecture

* **Interface & Mockup**: [page.tsx](file:///Users/apple/Web%20App%20Projects/vaitsk/src/app/page.tsx) - Main interactive screen featuring simulated preset transcript buttons, voice waveform, live transcription feed, suggested items box, and task board tabs.
* **API Extraction Handler**: [route.ts](file:///Users/apple/Web%20App%20Projects/vaitsk/src/app/api/extract/route.ts) - Receives transcripts, executes Google Gemini `gemini-1.5-flash` in JSON-mode, and drops back to `localExtractor.ts` upon key omission.
* **Database Adapter**: [firebase.ts](file:///Users/apple/Web%20App%20Projects/vaitsk/src/lib/firebase.ts) - Dispatches tasks, decisions, and blockers to Firestore or browser `localStorage`.
* **Roster & Rules fallback**: [localExtractor.ts](file:///Users/apple/Web%20App%20Projects/vaitsk/src/lib/localExtractor.ts) - Rule mappings for assignees, relative date targets, and priority markers.

---

## 🛠️ Verification & Build Checks
To verify that your typescript configurations and routes build perfectly:
```bash
npm run build
```
This runs Next.js compiler checks and linter verification to ensure the codebase has zero compilation errors.
