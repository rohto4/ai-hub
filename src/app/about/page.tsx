import { PublicScaffold } from '@/components/site/PublicScaffold'

export default function AboutPage() {
  return (
    <PublicScaffold
      title="About"
      description="AI Trend Hub は、AI 領域の最新情報を自動収集・要約して届けるトレンドハブです。"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h2 className="text-lg font-extrabold">AI Trend Hub とは</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-[#4f5969]">
            <li>OpenAI・Google・Anthropic など主要な公式ブログ・学術論文・ニュースを自動収集します。</li>
            <li>各記事を AI が100字で要約し、テーマ別タグを付与します。</li>
            <li>アクティビティとコンテンツスコアに基づいたランキングで「今注目の記事」を把握できます。</li>
          </ul>
        </section>
        <section className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h2 className="text-lg font-extrabold">更新の仕組み</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-[#4f5969]">
            <li>毎時 :00 に各ソースから新着記事を収集します。</li>
            <li>:10〜:40 に AI 要約・タグ付けを自動実行します。</li>
            <li>:50 に公開面へ反映し、ランキングを再計算します。</li>
          </ul>
        </section>
      </div>
    </PublicScaffold>
  )
}
