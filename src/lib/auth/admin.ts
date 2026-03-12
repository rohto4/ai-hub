import { getApps, initializeApp, cert, App } from 'firebase-admin/app'
import { getAuth, DecodedIdToken } from 'firebase-admin/auth'

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // 環境変数の改行エスケープを復元
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

/**
 * Authorization ヘッダーの Bearer トークンを検証し UID を返す
 * 検証失敗時は null を返す（例外は投げない）
 */
export async function verifyIdToken(
  authHeader: string | null
): Promise<DecodedIdToken | null> {
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  try {
    const app = getAdminApp()
    return await getAuth(app).verifyIdToken(token)
  } catch {
    return null
  }
}

/**
 * Cron/Internal API の認証
 * Authorization: Bearer <CRON_SECRET>
 */
export function verifyCronSecret(authHeader: string | null): boolean {
  if (!process.env.CRON_SECRET) return false
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}
