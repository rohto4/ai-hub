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
          rawUnprocessedNonPaper: 0,
          rawDueNowNonPaper: 0,
          rawLockedNonPaper: 0,
          rawOver24hNonPaper: 0,
          rawUnprocessedPaper: 0,
          rawDueNowPaper: 0,
          rawLockedPaper: 0,
          rawOver24hPaper: 0,
          rawWithError: 0,
          manualPending: 0,
          publishCandidatesPending: 0,
          currentRunningJobs: 0,
          paperSharePercent: 0,
          estimatedDrainHoursAtScheduledRate: 0,
          estimatedDrainHoursNonPaper: 0,
          estimatedDrainHoursPaper: 0,
          topNonPaperSourceKey: null,
          topNonPaperSourcePending: 0,
          topPaperSourceKey: null,
          topPaperSourcePending: 0,
        },
        jobs: [],
        topNonPaperSources: [],
        topPaperSources: [],
        recommendations: [],
      }

  return <AdminEnrichQueueClient initialData={data} />
}
