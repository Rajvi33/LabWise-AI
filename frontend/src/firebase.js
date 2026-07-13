import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

function readEnvValue(key) {
  return import.meta.env[key]?.trim();
}

const firebaseConfig = {
  apiKey: readEnvValue("VITE_FIREBASE_API_KEY"),
  authDomain: readEnvValue("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnvValue("VITE_FIREBASE_PROJECT_ID"),
  appId: readEnvValue("VITE_FIREBASE_APP_ID"),
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);
const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;
