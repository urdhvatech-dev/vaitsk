# Step-by-Step Firebase Setup Guide

Follow these steps to set up a Firebase Project, create your Firestore database, and connect it to **Vaitsk** for real-time cloud synchronization.

---

## 💻 Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/) and log in with your Google account.
2. Click **Add Project** (or **Create a Project**).
3. Enter a project name (e.g., `vaitsk-project`).
4. (Optional) Choose whether to enable Google Analytics for this project, then click **Continue**.
5. Click **Create Project** and wait for it to provision. Once ready, click **Continue**.

---

## 📱 Step 2: Register a Web Application
To get the client configuration keys, register a Web App within your Firebase project:
1. In the center of the Firebase Project Overview dashboard, click the **Web icon** (`</>`).
2. Enter an App Nickname (e.g., `vaitsk-web`).
3. Click **Register App**.
4. Firebase will display a code block containing a `firebaseConfig` object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "123456789...",
     appId: "1:123456789:web:abcd1234..."
   };
   ```
5. Keep this screen open, or copy these keys. You will paste them into your environment file.

---

## 🗄️ Step 3: Initialize Cloud Firestore
Vaitsk utilizes Firestore to save tasks, decisions, blockers, and team rosters:
1. In the left sidebar of the Firebase console, click on **Build** -> **Firestore Database**.
2. Click the **Create Database** button.
3. Select your Database Location (choose a region closest to your user base, e.g., `us-central1` or `asia-south1`), then click **Next**.
4. Choose **Start in Test Mode** (this opens read/write permissions for development, letting you test immediately without authentication rules).
   * *Note: For production, you should tighten rules in the "Rules" tab.*
5. Click **Create**.

---

## 🔑 Step 4: Configure Local Environment Variables
Now, connect the app to your database using the keys copied in Step 2:
1. Open the `.env.local` file in the root folder of your project workspace (or create it if it does not exist).
2. Paste the Firebase keys in the following format:

```env
# =========================================================================
# Firebase Web Client Credentials
# =========================================================================
NEXT_PUBLIC_FIREBASE_API_KEY=paste_your_apiKey_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=paste_your_authDomain_here
NEXT_PUBLIC_FIREBASE_PROJECT_ID=paste_your_projectId_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=paste_your_storageBucket_here
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=paste_your_messagingSenderId_here
NEXT_PUBLIC_FIREBASE_APP_ID=paste_your_appId_here
```

---

## ⚡ Step 5: Start & Verify Cloud Synchronization
1. If your development server is running, **restart it** in your terminal so Next.js reads the new `.env.local` file:
   ```bash
   # Stop server with Ctrl+C, then restart:
   npm run dev
   ```
2. Open the page [http://localhost:3000](http://localhost:3000).
3. The indicator badge in the top right header will change to:
   `[DB: FIRESTORE_ONLINE]`
4. Start recording voice transcripts or run simulator presets on the left.
5. Save your suggested tasks to the board. They will immediately save to your Firestore instance and persist across devices/reloads! You can inspect the created collections (`tasks`, `decisions`, `blockers`, `team`) directly inside your Firebase Console under **Firestore Database -> Data**.
