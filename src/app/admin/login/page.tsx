'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const redirect = searchParams.get('redirect') ?? '/admin'
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, redirect }),
    })
    if (res.ok) {
      // ADMIN_SECRET をローカルストレージにも保存（API 呼び出し用）
      localStorage.setItem('admin_secret', secret)
      router.push(redirect)
    } else {
      setError('認証に失敗しました')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 p-8 rounded-lg shadow-lg w-80 space-y-4">
      <h1 className="text-white text-xl font-bold">Admin Login</h1>
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="ADMIN_SECRET"
        className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:outline-none focus:border-blue-500"
        required
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
      >
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <Suspense fallback={<div className="text-white">読み込み中...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
