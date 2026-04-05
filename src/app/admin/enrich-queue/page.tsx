import { AdminEnrichQueueClient } from '@/components/admin/AdminEnrichQueueClient'
import { getEnrichQueueDashboardData } from '@/lib/db/enrich-queue-dashboard'
import { isDatabaseConfigured } from '@/lib/db'

export default async function AdminEnrichQueuePage() {
  const data = isDatabaseConfigured()
    ? await getEnrichQueueDashboardData()
    : {
        checkedAt: new Date().toISOString(),
        summary: {
          rawUnprocessed: 0,
          rawDueNow: 0,
          rawLocked: 0,
          rawOver24h: 0,
          rawWithError: 0,
          manualPending: 0,
          publishCandidatesReady: 0,
          currentRunningJobs: 0,
          estimatedDrainHoursAtScheduledRate: 0,
          topSourceKey: null,
          topSourcePending: 0,
        },
        jobs: [],
        topSources: [],
        recommendations: [],
      }

  return <AdminEnrichQueueClient initialData={data} />
}
