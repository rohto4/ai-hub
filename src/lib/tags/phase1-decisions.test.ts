import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parsePhase1DecisionMarkdown,
  buildPhase1DecisionManifest,
} from '@/lib/tags/phase1-decisions'

test('parsePhase1DecisionMarkdown parses exported markdown rows', () => {
  const markdown = [
    '# Phase 1 Decisions',
    '',
    '| section | item_type | key | label | suggested | decision | counts | note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 現状タグ一覧 | current-tag | llm | LLM | 廃止 | 廃止 | {"articleCount":4121} | note-a |',
    '| 新規立項タグ一覧 | new-tag-candidate | gpt-4o | gpt-4o | 保留 | タグ行き | {"seenCount":10,"manualReviewRequired":false} | note-b |',
  ].join('\n')

  const rows = parsePhase1DecisionMarkdown(markdown)

  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    section: '現状タグ一覧',
    itemType: 'current-tag',
    key: 'llm',
    label: 'LLM',
    suggested: '廃止',
    decision: '廃止',
    counts: { articleCount: 4121 },
    note: 'note-a',
  })
  assert.equal(rows[1]?.counts?.seenCount, 10)
})

test('buildPhase1DecisionManifest groups rows by final action', () => {
  const rows = parsePhase1DecisionMarkdown([
    '# Phase 1 Decisions',
    '',
    '| section | item_type | key | label | suggested | decision | counts | note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 現状タグ一覧 | current-tag | llm | LLM | 廃止 | 廃止 | {"articleCount":4121} | |',
    '| 現状タグ一覧 | current-tag | openai | OpenAI | タグ行き | タグ行き | {"articleCount":833} | |',
    '| 現状タグ一覧 | current-tag | open source | OSS | カテゴリ行き | カテゴリ行き | {"articleCount":197} | |',
    '| 新規立項タグ一覧 | new-tag-candidate | gpt-4o | gpt-4o | 保留 | タグ行き | {"seenCount":10} | |',
    '| 新規立項タグ一覧 | new-tag-candidate | arxiv | arxiv | 保留 | 不採用 | {"seenCount":20} | |',
    '| 新規立項タグ一覧 | new-tag-candidate | cot | cot | 保留 | 保留 | {"seenCount":10} | |',
  ].join('\n'))

  const manifest = buildPhase1DecisionManifest({
    decisionRows: rows,
    aliasRows: [
      {
        groupId: 'alias-group-001',
        comparableKey: 'llm',
        decision: '廃止',
        recommendedCanonicalKey: 'llm',
        terms: ['llm', 'llms'],
      },
    ],
  })

  assert.deepEqual(manifest.currentTags.keepAsPrimaryTags.map((item) => item.key), ['openai'])
  assert.deepEqual(manifest.currentTags.moveToCategory.map((item) => item.key), ['open source'])
  assert.deepEqual(manifest.currentTags.deprecate.map((item) => item.key), ['llm'])
  assert.deepEqual(manifest.newTagCandidates.adoptAsPrimaryTags.map((item) => item.key), ['gpt-4o'])
  assert.deepEqual(manifest.newTagCandidates.reject.map((item) => item.key), ['arxiv'])
  assert.deepEqual(manifest.newTagCandidates.hold.map((item) => item.key), ['cot'])
  assert.deepEqual(manifest.aliases.deprecate.map((item) => item.groupId), ['alias-group-001'])
})
