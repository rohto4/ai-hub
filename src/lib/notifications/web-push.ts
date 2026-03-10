import webpush from 'web-push'

let configured = false

export function isWebPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

export function configureWebPush(): boolean {
  if (configured) return true
  if (!isWebPushConfigured()) return false

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configured = true
  return true
}

export async function sendDigestNotification(subscription: {
  endpoint: string
  keys: { auth: string; p256dh: string }
}, payload: {
  title: string
  body: string
  url: string
  tag: string
}) {
  if (!configureWebPush()) {
    throw new Error('web push not configured')
  }

  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    },
    JSON.stringify(payload)
  )
}
