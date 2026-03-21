import { AdminTagsClient } from '@/components/admin/AdminTagsClient'
import { listTagCandidates } from '@/lib/db/admin-operations'
import { isDatabaseConfigured } from '@/lib/db'

export default async function AdminTagsPage() {
  const candidates = isDatabaseConfigured() ? await listTagCandidates(200) : []
  return <AdminTagsClient initialCandidates={candidates} />
}
