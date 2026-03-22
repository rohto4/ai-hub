-- migration 037: 高品質サムネイルアセット用のカラム追加

ALTER TABLE tags_master
  ADD COLUMN IF NOT EXISTS icon_asset_path text,
  ADD COLUMN IF NOT EXISTS icon_asset_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_bg_texture text;

COMMENT ON COLUMN tags_master.icon_asset_path IS 'Gemini等で生成した高品質な透過アイコン画像（WebP等）へのパス';
COMMENT ON COLUMN tags_master.icon_asset_updated_at IS '高品質アイコンアセットの最終更新日時';
COMMENT ON COLUMN tags_master.preferred_bg_texture IS 'このタグがメインの際に推奨される背景テクスチャのキー';

-- 既存の主要タグに対して、将来のパスを想定して初期値をセットする（運用で上書き可能）
-- 実際のアセット配置は public/thumbs/assets/ 配下を想定
UPDATE tags_master SET icon_asset_path = '/thumbs/assets/gpt.webp' WHERE tag_key IN ('gpt-5', 'chatgpt');
UPDATE tags_master SET icon_asset_path = '/thumbs/assets/openai.webp' WHERE tag_key = 'openai';
UPDATE tags_master SET icon_asset_path = '/thumbs/assets/gemini.webp' WHERE tag_key = 'gemini';
UPDATE tags_master SET icon_asset_path = '/thumbs/assets/claude.webp' WHERE tag_key = 'claude';
UPDATE tags_master SET icon_asset_path = '/thumbs/assets/anthropic.webp' WHERE tag_key = 'anthropic';
UPDATE tags_master SET icon_asset_path = '/thumbs/assets/llama.webp' WHERE tag_key = 'llama';
UPDATE tags_master SET icon_asset_path = '/thumbs/assets/google.webp' WHERE tag_key IN ('google', 'google-ai');
