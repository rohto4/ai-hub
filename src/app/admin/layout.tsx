import type { ReactNode } from 'react'
import Link from 'next/link'
import { getAdminPagePath } from '@/lib/admin-path'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <span className="text-white font-bold text-lg">AI Trend Hub Admin</span>
        <nav className="flex gap-4 text-sm">
          <Link href={getAdminPagePath()} className="text-gray-300 hover:text-white">ダッシュボード</Link>
          <Link href={getAdminPagePath('/articles')} className="text-gray-300 hover:text-white">記事管理</Link>
          <Link href={getAdminPagePath('/tags')} className="text-gray-300 hover:text-white">タグレビュー</Link>
          <Link href={getAdminPagePath('/sources')} className="text-gray-300 hover:text-white">ソース管理</Link>
          <Link href={getAdminPagePath('/enrich-queue')} className="text-gray-300 hover:text-white">Enrich Ops</Link>
          <Link href={getAdminPagePath('/jobs')} className="text-gray-300 hover:text-white">ジョブログ</Link>
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
