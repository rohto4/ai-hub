'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js')
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    function handleInstalled() {
      setInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (installed) {
    return (
      <div className="rounded-2xl border border-black/5 bg-card-second px-4 py-3 text-[12px] text-accent-darker">
        ホーム画面への追加は完了しています。
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-card-second px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light text-[12px] font-extrabold text-accent-dark">
          APP
        </div>
        <div className="flex flex-col gap-1">
          <strong className="text-[14px] text-ink">AI Trend Hub をホーム画面に追加</strong>
          <span className="text-[12px] text-muted">次の通知実装に備えて、PWA の install 導線と service worker を先行で有効化しています。</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className="rounded-lg border border-black/5 px-3 py-2 text-[11px] font-bold text-ink">
          後で
        </button>
        <button
          type="button"
          className="rounded-lg border border-transparent bg-orange px-3 py-2 text-[11px] font-bold text-white"
          onClick={async () => {
            if (!promptEvent) return
            await promptEvent.prompt()
            await promptEvent.userChoice
            setPromptEvent(null)
          }}
        >
          {promptEvent ? '追加する' : 'インストール可能時に有効'}
        </button>
      </div>
    </div>
  )
}
