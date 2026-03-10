import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  }
}

export function getClientApp(): FirebaseApp | null {
  const config = getFirebaseConfig()
  if (!config.apiKey || !config.authDomain || !config.projectId) return null
  return getApps().length > 0 ? getApp() : initializeApp(config)
}

export function getClientAuth() {
  const app = getClientApp()
  return app ? getAuth(app) : null
}
