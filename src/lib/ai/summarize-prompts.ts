export const PROMPT_100 = `
以下の記事を日本語で100文字程度以内に要約してください。
- 主観や推測の補足は避けること
- 記事内容の範囲で書くこと
- 箇条書きや敬体は不要
- 100文字を超えないこと

記事タイトル: {title}
記事本文:
{content}
`.trim()

export const PROMPT_CRITIQUE = `
以下の記事について、AIの観点から200文字程度以内で批評してください。
- 重要な論点や注意点、示唆を簡潔に述べること
- 中立的・簡潔な日本語で書くこと

記事タイトル: {title}
記事本文:
{content}
`.trim()

export function buildExtendedSummaryPrompt(title: string, content: string, length: number): string {
  return `
以下の記事を日本語で${length}文字程度以内に要約してください。
- 重要な事実、背景、意味を含めること
- ${length}文字を大きく超えないこと

記事タイトル: ${title}
記事本文:
${content.slice(0, 4000)}
  `.trim()
}
