import Link from 'next/link'
import { getAdminPagePath } from '@/lib/admin-path'

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">管理ダッシュボード</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href={getAdminPagePath('/articles')} className="block p-6 bg-gray-900 rounded-lg hover:bg-gray-800 border border-gray-800">
          <h2 className="text-white font-semibold text-lg mb-1">記事管理</h2>
          <p className="text-gray-400 text-sm">公開記事の非表示・再公開</p>
        </Link>
        <Link href={getAdminPagePath('/tags')} className="block p-6 bg-gray-900 rounded-lg hover:bg-gray-800 border border-gray-800">
          <h2 className="text-white font-semibold text-lg mb-1">タグレビュー</h2>
          <p className="text-gray-400 text-sm">候補タグのマスタへの昇格・キーワード追加</p>
        </Link>
        <Link href={getAdminPagePath('/sources')} className="block p-6 bg-gray-900 rounded-lg hover:bg-gray-800 border border-gray-800">
          <h2 className="text-white font-semibold text-lg mb-1">ソース管理</h2>
          <p className="text-gray-400 text-sm">フィードの有効・無効切替</p>
        </Link>
        <Link href={getAdminPagePath('/jobs')} className="block p-6 bg-gray-900 rounded-lg hover:bg-gray-800 border border-gray-800">
          <h2 className="text-white font-semibold text-lg mb-1">ジョブログ</h2>
          <p className="text-gray-400 text-sm">hourly-fetch / enrich-worker / hourly-publish / hourly-compute-ranks の実行履歴と失敗ログ</p>
        </Link>
        <Link href={getAdminPagePath('/enrich-queue')} className="block p-6 bg-gray-900 rounded-lg hover:bg-gray-800 border border-gray-800">
          <h2 className="text-white font-semibold text-lg mb-1">Enrich Ops</h2>
          <p className="text-gray-400 text-sm">backlog、推奨フォロープラン、即時実行を 1 画面で確認</p>
        </Link>
      </div>
    </div>
  )
}
