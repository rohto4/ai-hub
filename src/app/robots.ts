import type { MetadataRoute } from 'next'
import { getAdminBasePath } from '@/lib/admin-path'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  const adminBasePath = getAdminBasePath()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          `${adminBasePath}/`,
          `${adminBasePath}/api/`,
          '/admin/',
          '/api/admin/',
          '/api/cron/',
          '/api/actions',
          '/api/push/',
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
