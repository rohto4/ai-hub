import { PublicScaffold } from '@/components/site/PublicScaffold'

export default function AboutPage() {
  return (
    <PublicScaffold
      title="About"
      description="AI Trend Hub の公開面、バッチ、ランキングの流れを短く確認するためのページです。"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h2 className="text-lg font-extrabold">公開面の前提</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-[#4f5969]">
            <li>公開面は layer4 だけを読みます。</li>
            <li>L2 の `articles_enriched` は直接表示しません。</li>
            <li>source_type / topic / tags の 3 軸を分離して扱います。</li>
          </ul>
        </section>
        <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h2 className="text-lg font-extrabold">バッチの流れ</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-[#4f5969]">
            <li>`hourly-fetch` が raw を収集します。</li>
            <li>`daily-enrich` が title / summary / tags / publish 判定を付けます。</li>
            <li>`hourly-publish` が `public_articles` へ転送します。</li>
            <li>`compute-ranks` が `public_rankings` を更新します。</li>
          </ul>
        </section>
      </div>
    </PublicScaffold>
  )
}
