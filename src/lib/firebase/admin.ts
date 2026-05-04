import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;
  cachedApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
  return cachedApp;
}

let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

function lazy<T extends object>(load: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const target = load();
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(_target, prop) {
      return Reflect.has(load(), prop);
    },
  });
}

export const adminAuth = lazy<Auth>(() => {
  if (!cachedAuth) cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
});

export const db = lazy<Firestore>(() => {
  if (!cachedDb) cachedDb = getFirestore(getAdminApp());
  return cachedDb;
});
