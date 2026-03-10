import { ImageResponse } from '@vercel/og'

export const runtime = 'edge'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: 48,
          background: 'linear-gradient(135deg, #fff9f3 0%, #ffe7d4 55%, #ffd4b9 100%)',
          color: '#1f2630',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            border: '2px solid rgba(31,38,48,0.08)',
            borderRadius: 32,
            background: 'rgba(255,255,255,0.78)',
            padding: 42,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  background: '#f28a43',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                AI
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 22, color: '#8a4a20', fontWeight: 700 }}>AI Trend Hub</span>
                <span style={{ fontSize: 18, color: '#6f7785' }}>発見・理解・共有を1画面でつなぐ</span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                borderRadius: 999,
                background: '#fff1e4',
                padding: '10px 18px',
                fontSize: 18,
                color: '#8a4a20',
                fontWeight: 700,
              }}
            >
              100字要約
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 62, fontWeight: 800, lineHeight: 1.1 }}>今日のAIトレンドを、日本語で速くつかむ。</div>
            <div style={{ fontSize: 28, lineHeight: 1.5, color: '#4b4b51' }}>
              公式・ブログ・動画を広く集め、100字要約と批評で圧縮。シェア時は OGP だけで価値が伝わる。
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            {['Google Alerts中心の収集', 'Topic Group導線', 'PWAダイジェスト通知'].map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  borderRadius: 999,
                  background: '#fff',
                  border: '1px solid rgba(31,38,48,0.08)',
                  padding: '12px 18px',
                  fontSize: 20,
                  color: '#1f2630',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  )
}
