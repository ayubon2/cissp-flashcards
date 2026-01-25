# CISSP Quiz PWA

CISSP（Certified Information Systems Security Professional）資格試験対策用のPWAクイズアプリケーションです。

## 機能一覧

- **817問のCISSP試験問題**（8ドメイン + 4模擬試験）
- **日本語/英語切替**対応
- **複数デッキ対応**（カスタムデッキのインポート可能）
- **localStorageによる学習履歴の保存**
- **スター機能**と**誤り報告**機能
- **豊富なフィルタリング**
  - ドメイン別（8ドメイン）
  - 模擬試験別（4回分）
  - タグ別
  - 難易度別（easy/medium/hard）
  - 習熟度別（未回答/誤答/学習中/習得済み）
- **全データのエクスポート/インポート**（iCloud同期用）
- **iOS向けPWA対応**（オフライン対応、ホーム画面追加）

## 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | React 19 + TypeScript |
| ビルドツール | Vite 7 |
| スタイリング | Tailwind CSS 4 |
| アイコン | Lucide React |
| PWA | vite-plugin-pwa |

## 開発

```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# 本番ビルドのプレビュー
npm run preview
```

## デプロイ（Vercel）

1. [vercel.com](https://vercel.com)にログイン
2. 「Import Project」からこのリポジトリを選択
3. フレームワークは「Vite」が自動検出されます
4. 「Deploy」をクリック

## iOSでPWAインストール

1. Safariでデプロイ先URLを開く
2. 共有ボタンをタップ
3. 「ホーム画面に追加」を選択

## データ形式

カスタムデッキをインポートする場合は、以下のJSON形式に従ってください：

```json
[
  {
    "chapter": 1,
    "domain_jp": "セキュリティとリスクマネジメント",
    "domain_en": "Security and Risk Management",
    "id": 1,
    "type": "single",
    "question_jp": "問題文（日本語）",
    "question_en": "Question text (English)",
    "options": [
      { "label": "A", "text_jp": "選択肢A", "text_en": "Option A" },
      { "label": "B", "text_jp": "選択肢B", "text_en": "Option B" },
      { "label": "C", "text_jp": "選択肢C", "text_en": "Option C" },
      { "label": "D", "text_jp": "選択肢D", "text_en": "Option D" }
    ],
    "answer": "A",
    "explanation_jp": "解説（日本語）",
    "explanation_en": "Explanation (English)",
    "tags_jp": ["タグ1", "タグ2"],
    "tags_en": ["tag1", "tag2"],
    "difficulty": "medium"
  }
]
```

### chapterとドメインの対応

| chapter | 種別 | domain_jp | domain_en |
|---------|------|-----------|-----------|
| 1 | ドメイン | セキュリティとリスクマネジメント | Security and Risk Management |
| 2 | ドメイン | 資産のセキュリティ | Asset Security |
| 3 | ドメイン | セキュリティアーキテクチャとエンジニアリング | Security Architecture and Engineering |
| 4 | ドメイン | 通信とネットワークのセキュリティ | Communication and Network Security |
| 5 | ドメイン | アイデンティティとアクセスの管理 | Identity and Access Management |
| 6 | ドメイン | セキュリティの評価とテスト | Security Assessment and Testing |
| 7 | ドメイン | セキュリティの運用 | Security Operations |
| 8 | ドメイン | ソフトウェア開発セキュリティ | Software Development Security |
| 9 | 模擬試験 | 模擬試験1 | Practice Exam 1 |
| 10 | 模擬試験 | 模擬試験2 | Practice Exam 2 |
| 11 | 模擬試験 | 模擬試験3 | Practice Exam 3 |
| 12 | 模擬試験 | 模擬試験4 | Practice Exam 4 |

## ライセンス

Private
