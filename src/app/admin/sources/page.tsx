import { AdminSourcesClient } from '@/components/admin/AdminSourcesClient'
import { listAdminSources } from '@/lib/db/admin-operations'
import { isDatabaseConfigured } from '@/lib/db'

export default async function AdminSourcesPage() {
  const sources = isDatabaseConfigured() ? await listAdminSources() : []
  return <AdminSourcesClient initialSources={sources} />
}
