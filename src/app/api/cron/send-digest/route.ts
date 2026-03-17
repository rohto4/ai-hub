import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { listDigestArticles } from '@/lib/db/public-feed'
import { isWebPushConfigured, sendDigestNotification } from '@/lib/notifications/web-push'

export const runtime = 'nodejs'
export const maxDuration = 60

type SubscriptionRow = {
  push_subscription_id: string
  endpoint: string
  keys: { auth: string; p256dh: string }
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: 'web push not configured' }, { status: 503 })
  }

  const sql = getSql()
  const subscriptions = (await sql`
    SELECT push_subscription_id, endpoint, keys
    FROM push_subscriptions
    WHERE active = true
  `) as SubscriptionRow[]

  const articles = await listDigestArticles(3)
  const topArticle = articles[0]
  if (!topArticle) {
    return NextResponse.json({
      sent: 0,
      skipped: subscriptions.length,
      reason: 'no ranked articles',
    })
  }

  let sent = 0
  for (const subscription of subscriptions) {
    await sql`
      INSERT INTO digest_logs (subscription_id, scheduled_at, article_ids)
      VALUES (${subscription.push_subscription_id}, now(), ${articles.map((article) => article.id)})
    `

    try {
      await sendDigestNotification(subscription, {
        title: 'AI Trend Hub ダイジェスト',
        body: topArticle.summary_100 ?? topArticle.title,
        url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        tag: 'daily-digest',
      })
      sent++
      await sql`
        UPDATE digest_logs
        SET sent_at = now(), status = 'sent'
        WHERE subscription_id = ${subscription.push_subscription_id}
          AND scheduled_at = (
            SELECT max(scheduled_at)
            FROM digest_logs
            WHERE subscription_id = ${subscription.push_subscription_id}
          )
      `
    } catch (error) {
      await sql`
        UPDATE digest_logs
        SET status = 'failed',
            error_msg = ${error instanceof Error ? error.message : 'unknown error'},
            retry_count = retry_count + 1
        WHERE subscription_id = ${subscription.push_subscription_id}
          AND scheduled_at = (
            SELECT max(scheduled_at)
            FROM digest_logs
            WHERE subscription_id = ${subscription.push_subscription_id}
          )
      `
    }
  }

  return NextResponse.json({ sent, skipped: subscriptions.length - sent })
}
