# mock2 導線メモ

最終更新: 2026-03-12

## 採用した構成

- 左: グローバル導線
- 中: 現在 route の主表示
- 右: 300字要約 / 批評 / 遷移ログ

この構成を採用した理由:

- 「今どこにいるか」と「次にどこへ行けるか」を同時に見せやすい
- Home / Search / Topic Group / Digest / Saved / Settings の往復確認が速い
- ページ遷移しない操作も、右ペインや share modal で動的状態として確認できる

## 主導線

1. Home Feed
   - 300字を開く
   - Share Composer を開く
   - Topic Group へ移る
   - 保存する
   - 元記事へ行く想定を確認する
2. Search Results
   - 検索結果から 300字 / Share / Topic Group へ分岐
3. Topic Group
   - 同一話題の動画 / 公式 / ブログを比較
   - 比較後に Feed へ戻る
4. Digest Center
   - 通知クリック後に 300字 / Share / 保存へ直行
5. Saved Queue
   - 後で読むから Topic Group / Share へ再開
6. Preferences
   - 興味分野 / 通知設定が Digest にどう効くかを確認

## 動的要素

- 300字要約: 右ペインで動的更新
- Share Composer: modal で起動
- Share タグ切替: modal 内で即時反映
- Misskey instance: modal 内で保存
- 保存状態: Saved Queue に即時反映
- 遷移ログ: 右ペイン下部に即時反映

## 確認したい観点

- Home から Share / Topic Group / Saved へ迷わず流れるか
- Search が「別世界」にならず Feed と連続した体験になっているか
- Digest が単なる通知一覧で終わらず、共有起点として機能するか
- Settings が孤立せず、通知と Digest の関係を説明できているか
