BEGIN;

-- 1. backlog import 後に残った title 日本語化漏れを補正
UPDATE articles_enriched AS ae
SET title = fixes.title
FROM (
  VALUES
    (1069, 'LWiAI Podcast #234：Opus 4.6、GPT-5.3、Seedance 2.0 を解説'),
    (2014, 'Swift Transformers 公開：Apple デバイス上でオンデバイス LLM を動かす'),
    (2643, 'Image GPT：画像生成に向けた GPT'),
    (2645, 'OpenAI API の紹介'),
    (2651, 'Jukebox：ニューラルネットによる音楽生成'),
    (2656, 'OpenAI Microscope：ニューラルネットワーク可視化ツール'),
    (2670, 'Safety Gym：安全性重視の強化学習ベンチマーク'),
    (2682, 'The Reformer：効率的な Transformer アーキテクチャ'),
    (2686, 'Learning Day：OpenAI の学習イベント'),
    (2693, 'MuseNet：ディープラーニングで生成する音楽'),
    (2709, 'Spinning Up in Deep RL：深層強化学習入門'),
    (2727, 'OpenAI Five：Dota 2 に挑む AI チーム'),
    (2744, 'OpenAI Scholars：OpenAI 奨学生プログラム')
) AS fixes(raw_article_id, title)
WHERE ae.raw_article_id = fixes.raw_article_id::bigint;

-- 2. L2 / L4 の source_type を source_targets に再同期
UPDATE articles_enriched AS ae
SET source_type = st.source_type
FROM source_targets AS st
WHERE st.source_target_id = ae.source_target_id
  AND ae.source_type IS DISTINCT FROM st.source_type;

UPDATE public_articles AS pa
SET source_category = st.source_category,
    source_type = st.source_type,
    updated_at = now()
FROM source_targets AS st
WHERE st.source_target_id = pa.primary_source_target_id
  AND (
    pa.source_category IS DISTINCT FROM st.source_category
    OR pa.source_type IS DISTINCT FROM st.source_type
  );

COMMIT;

-- 3. 反映確認用クエリ
SELECT source_type, COUNT(*) AS enriched_count
FROM articles_enriched
GROUP BY source_type
ORDER BY enriched_count DESC, source_type;

SELECT source_type, COUNT(*) AS public_count
FROM public_articles
WHERE visibility_status = 'published'
GROUP BY source_type
ORDER BY public_count DESC, source_type;
