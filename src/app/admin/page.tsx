import Link from 'next/link'

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">管理ダッシュボード</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/articles" className="block p-6 bg-gray-900 rounded-lg hover:bg-gray-800 border border-gray-800">
          <h2 className="text-white font-semibold text-lg mb-1">記事管理</h2>
          <p className="text-gray-400 text-sm">公開記事の非表示・再公開</p>
        </Link>
        <Link href="/admin/tags" className="block p-6 bg-gray-900 rounded-lg hover:bg-gray-800 border border-gray-800">
          <h2 className="text-white font-semibold text-lg mb-1">タグレビュー</h2>
          <p className="text-gray-400 text-sm">候補タグのマスタへの昇格・キーワード追加</p>
        </Link>
        <Link href="/admin/sources" className="block p-6 bg-gray-900 rounded-lg hover:bg-gray-800 border border-gray-800">
          <h2 className="text-white font-semibold text-lg mb-1">ソース管理</h2>
          <p className="text-gray-400 text-sm">フィードの有効・無効切替</p>
        </Link>
      </div>
    </div>
  )
}
