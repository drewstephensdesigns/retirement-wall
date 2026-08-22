// ============================================================
// Paste your Firebase project's config below.
// Get this from: Firebase Console → Project Settings → General
// → "Your apps" → Web app → SDK setup and configuration
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3j63TsB_pWEWeOKcIwek90vJFI3tClRg",
  authDomain: "blue-skies-wall.firebaseapp.com",
  projectId: "blue-skies-wall",
  storageBucket: "blue-skies-wall.firebasestorage.app",
  messagingSenderId: "111995248155",
  appId: "1:111995248155:web:06d8836cb42223db0762be"

};

export const app = initializeApp(firebaseConfig);
