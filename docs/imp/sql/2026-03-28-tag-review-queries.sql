-- AI Trend Hub
-- タグ整理・導線検討のための参照 SQL 集
-- 目的:
-- 1. 人間が DB の現状を直接確認する
-- 2. 主タグ / 新規立項候補 / カテゴリ / 周辺分野タグの判断材料を揃える
-- 3. 中間レポート用ファイルを別途作らず、TBL をそのまま見て判断する

/* ----------------------------------------------------------------------
1. 主タグマスタの全体像
   - 既存タグごとの alias / keyword 数
   - L2 / L4 で実際に何件付いているか
---------------------------------------------------------------------- */
WITH l2_counts AS (
  SELECT aet.tag_id, COUNT(*)::int AS l2_article_count
  FROM articles_enriched_tags aet
  GROUP BY aet.tag_id
),
l4_counts AS (
  SELECT pat.tag_id, COUNT(*)::int AS l4_article_count
  FROM public_article_tags pat
  GROUP BY pat.tag_id
),
alias_counts AS (
  SELECT ta.tag_id, COUNT(*)::int AS alias_count
  FROM tag_aliases ta
  GROUP BY ta.tag_id
),
keyword_counts AS (
  SELECT tk.tag_id, COUNT(*)::int AS keyword_count
  FROM tag_keywords tk
  GROUP BY tk.tag_id
)
SELECT
  tm.tag_id,
  tm.tag_key,
  tm.display_name,
  tm.is_active,
  tm.article_count AS master_article_count,
  COALESCE(l2.l2_article_count, 0) AS l2_article_count,
  COALESCE(l4.l4_article_count, 0) AS l4_article_count,
  COALESCE(ac.alias_count, 0) AS alias_count,
  COALESCE(kc.keyword_count, 0) AS keyword_count,
  tm.last_seen_at,
  tm.created_at
FROM tags_master tm
LEFT JOIN l2_counts l2 ON l2.tag_id = tm.tag_id
LEFT JOIN l4_counts l4 ON l4.tag_id = tm.tag_id
LEFT JOIN alias_counts ac ON ac.tag_id = tm.tag_id
LEFT JOIN keyword_counts kc ON kc.tag_id = tm.tag_id
ORDER BY COALESCE(l4.l4_article_count, 0) DESC,
         COALESCE(l2.l2_article_count, 0) DESC,
         tm.display_name;

/* ----------------------------------------------------------------------
2. 主タグ辞書の詳細確認
   - 1タグにつく alias / keyword を 1 行で確認
---------------------------------------------------------------------- */
SELECT
  tm.tag_key,
  tm.display_name,
  COALESCE(
    string_agg(DISTINCT ta.alias_key, ' | ' ORDER BY ta.alias_key)
      FILTER (WHERE ta.alias_key IS NOT NULL),
    ''
  ) AS aliases,
  COALESCE(
    string_agg(DISTINCT tk.keyword, ' | ' ORDER BY tk.keyword)
      FILTER (WHERE tk.keyword IS NOT NULL),
    ''
  ) AS keywords
FROM tags_master tm
LEFT JOIN tag_aliases ta ON ta.tag_id = tm.tag_id
LEFT JOIN tag_keywords tk ON tk.tag_id = tm.tag_id
GROUP BY tm.tag_key, tm.display_name
ORDER BY tm.display_name;

/* ----------------------------------------------------------------------
3. 新規立項候補の確認
   - まだ昇格していない候補
   - 既存タグへ寄せられそうな候補の当たりを付ける
---------------------------------------------------------------------- */
SELECT
  tcp.tag_candidate_id,
  tcp.candidate_key,
  tcp.display_name,
  tcp.review_status,
  tcp.seen_count,
  tcp.manual_review_required,
  tcp.latest_trends_score,
  tcp.first_seen_at,
  tcp.last_seen_at,
  tm.tag_key AS promoted_tag_key
FROM tag_candidate_pool tcp
LEFT JOIN tags_master tm ON tm.tag_id = tcp.promoted_tag_id
WHERE tcp.review_status IN ('candidate', 'trend_matched', 'manual_review')
ORDER BY tcp.seen_count DESC, tcp.last_seen_at DESC, tcp.display_name;

/* ----------------------------------------------------------------------
4. 候補と既存辞書の重なり確認
   - candidate_key が alias / keyword / tag_key と文字列一致するものを確認
---------------------------------------------------------------------- */
WITH dict AS (
  SELECT tm.tag_id, tm.tag_key, tm.display_name, 'tag_key'::text AS matched_by, tm.tag_key AS token
  FROM tags_master tm
  UNION ALL
  SELECT tm.tag_id, tm.tag_key, tm.display_name, 'alias'::text AS matched_by, ta.alias_key AS token
  FROM tags_master tm
  JOIN tag_aliases ta ON ta.tag_id = tm.tag_id
  UNION ALL
  SELECT tm.tag_id, tm.tag_key, tm.display_name, 'keyword'::text AS matched_by, tk.keyword AS token
  FROM tags_master tm
  JOIN tag_keywords tk ON tk.tag_id = tm.tag_id
)
SELECT
  tcp.candidate_key,
  tcp.display_name AS candidate_display_name,
  tcp.review_status,
  tcp.seen_count,
  d.tag_key,
  d.display_name AS matched_tag_display_name,
  d.matched_by
FROM tag_candidate_pool tcp
JOIN dict d
  ON lower(tcp.candidate_key) = lower(d.token)
WHERE tcp.review_status IN ('candidate', 'trend_matched', 'manual_review')
ORDER BY tcp.seen_count DESC, tcp.candidate_key, d.matched_by;

/* ----------------------------------------------------------------------
5. 主タグの代表記事確認
   - あるタグがどんな記事に付いているかを spot check する
   - WHERE の tag_key を差し替えて使う
---------------------------------------------------------------------- */
SELECT
  tm.tag_key,
  pa.public_key,
  pa.display_title,
  pa.source_type,
  pa.source_category,
  pa.original_published_at
FROM public_article_tags pat
JOIN tags_master tm ON tm.tag_id = pat.tag_id
JOIN public_articles pa ON pa.public_article_id = pat.public_article_id
WHERE tm.tag_key = 'openai'
ORDER BY pa.original_published_at DESC NULLS LAST
LIMIT 50;

/* ----------------------------------------------------------------------
6. カテゴリ候補の現況確認
   - サイドバー導線を考えるための source_type / source_category 分布
---------------------------------------------------------------------- */
SELECT
  pa.source_type,
  pa.source_category,
  COUNT(*)::int AS article_count
FROM public_articles pa
WHERE pa.visibility_status = 'published'
GROUP BY pa.source_type, pa.source_category
ORDER BY article_count DESC, pa.source_type, pa.source_category;

/* ----------------------------------------------------------------------
7. 周辺分野タグマスタの全体像
   - 将来のマッピングページ用にも使える基礎確認
---------------------------------------------------------------------- */
WITH l2_counts AS (
  SELECT aeat.adjacent_tag_id, COUNT(*)::int AS l2_article_count
  FROM articles_enriched_adjacent_tags aeat
  GROUP BY aeat.adjacent_tag_id
),
l4_counts AS (
  SELECT paat.adjacent_tag_id, COUNT(*)::int AS l4_article_count
  FROM public_article_adjacent_tags paat
  GROUP BY paat.adjacent_tag_id
),
keyword_counts AS (
  SELECT atk.adjacent_tag_id, COUNT(*)::int AS keyword_count
  FROM adjacent_tag_keywords atk
  GROUP BY atk.adjacent_tag_id
)
SELECT
  atm.adjacent_tag_id,
  atm.tag_key,
  atm.display_name,
  atm.theme_key,
  atm.priority,
  atm.is_active,
  atm.article_count AS master_article_count,
  COALESCE(l2.l2_article_count, 0) AS l2_article_count,
  COALESCE(l4.l4_article_count, 0) AS l4_article_count,
  COALESCE(kc.keyword_count, 0) AS keyword_count
FROM adjacent_tags_master atm
LEFT JOIN l2_counts l2 ON l2.adjacent_tag_id = atm.adjacent_tag_id
LEFT JOIN l4_counts l4 ON l4.adjacent_tag_id = atm.adjacent_tag_id
LEFT JOIN keyword_counts kc ON kc.adjacent_tag_id = atm.adjacent_tag_id
ORDER BY COALESCE(l4.l4_article_count, 0) DESC,
         COALESCE(l2.l2_article_count, 0) DESC,
         atm.priority ASC;

/* ----------------------------------------------------------------------
8. 周辺分野タグの代表記事確認
   - WHERE の adjacent tag_key を差し替えて使う
---------------------------------------------------------------------- */
SELECT
  atm.tag_key AS adjacent_tag_key,
  pa.public_key,
  pa.display_title,
  pa.source_type,
  pa.source_category,
  pa.original_published_at
FROM public_article_adjacent_tags paat
JOIN adjacent_tags_master atm ON atm.adjacent_tag_id = paat.adjacent_tag_id
JOIN public_articles pa ON pa.public_article_id = paat.public_article_id
WHERE atm.tag_key = 'infra'
ORDER BY pa.original_published_at DESC NULLS LAST
LIMIT 50;

/* ----------------------------------------------------------------------
9. タグ未付与の公開記事確認
   - 主タグ導線の穴を見るための確認
---------------------------------------------------------------------- */
SELECT
  pa.public_key,
  pa.display_title,
  pa.source_type,
  pa.source_category,
  pa.summary_input_basis,
  pa.original_published_at
FROM public_articles pa
LEFT JOIN public_article_tags pat
  ON pat.public_article_id = pa.public_article_id
WHERE pa.visibility_status = 'published'
GROUP BY
  pa.public_article_id,
  pa.public_key,
  pa.display_title,
  pa.source_type,
  pa.source_category,
  pa.summary_input_basis,
  pa.original_published_at
HAVING COUNT(pat.tag_id) = 0
ORDER BY pa.original_published_at DESC NULLS LAST
LIMIT 200;

/* ----------------------------------------------------------------------
10. 主タグ × 周辺分野タグの掛け合わせ
    - 将来の視覚的マッピングページの基礎データ確認
    - WHERE の主タグを差し替えて使う
---------------------------------------------------------------------- */
SELECT
  tm.tag_key AS primary_tag_key,
  atm.tag_key AS adjacent_tag_key,
  COUNT(*)::int AS article_count
FROM public_article_tags pat
JOIN tags_master tm ON tm.tag_id = pat.tag_id
JOIN public_articles pa ON pa.public_article_id = pat.public_article_id
JOIN public_article_adjacent_tags paat ON paat.public_article_id = pa.public_article_id
JOIN adjacent_tags_master atm ON atm.adjacent_tag_id = paat.adjacent_tag_id
WHERE tm.tag_key = 'openai'
GROUP BY tm.tag_key, atm.tag_key
ORDER BY article_count DESC, adjacent_tag_key;
