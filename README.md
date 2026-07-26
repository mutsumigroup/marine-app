# マリン業務管理システム

船舶業務の日報入力から、売上管理・請求書発行・入金管理までを一元管理するWebアプリです。  
データは **Supabase** に保存され、PCとスマートフォンで同じデータを共有できます。

---

## セットアップ手順

### 1. Supabaseプロジェクト作成

1. [supabase.com](https://supabase.com) にアクセスし、アカウントを作成
2. 「New Project」でプロジェクトを作成
3. **Settings → API** を開き以下をメモ
   - `Project URL`（例: `https://xxxxxxxxxx.supabase.co`）
   - `anon public` キー

### 2. データベーススキーマを適用

1. Supabaseダッシュボードの **SQL Editor** を開く
2. `supabase/schema.sql` の内容をすべてコピーして貼り付け
3. **Run** ボタンで実行

### 3. 環境変数を設定

```bash
cp .env.example .env
```

`.env` を開いて編集:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...（anon public キー）
```

### 4. 依存パッケージのインストールと起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開く

### 5. 本番デプロイ（Vercel推奨）

```bash
npm run build
```

[Vercel](https://vercel.com) にデプロイする場合:
1. GitHubにpush
2. Vercelでリポジトリをインポート
3. Environment Variables に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を設定
4. Deploy

---

## ファイル構成

```
marine-app/
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx        # サイドバーナビ
│   │   └── UI.tsx             # 共通UIコンポーネント
│   ├── hooks/
│   │   └── useAppState.ts     # 状態管理（Supabase連携）
│   ├── lib/
│   │   ├── api.ts             # Supabase CRUD操作
│   │   ├── pdf.ts             # PDF生成（jsPDF）
│   │   └── supabase.ts        # Supabaseクライアント
│   ├── pages/
│   │   ├── Dashboard.tsx      # ダッシュボード
│   │   ├── DailyForm.tsx      # 日報作成
│   │   ├── ReportsList.tsx    # 日報一覧
│   │   ├── Sales.tsx          # 売上管理
│   │   ├── Invoices.tsx       # 請求書管理
│   │   ├── Payments.tsx       # 入金管理
│   │   ├── Annual.tsx         # 年間売上管理
│   │   └── Settings.tsx       # 設定
│   ├── types/index.ts         # TypeScript型定義
│   ├── App.tsx                # ルーティング
│   ├── main.tsx               # エントリポイント
│   └── index.css              # グローバルCSS
├── supabase/
│   └── schema.sql             # DBスキーマ（初回のみ実行）
├── .env.example               # 環境変数テンプレート
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## データ保存の仕組み

| 操作 | 保存先 |
|------|--------|
| 日報送信 | `reports` テーブル（INSERT）|
| 請求書自動生成 | `invoices` テーブル（UPSERT）|
| 請求書送信 | `invoices` ステータス更新（UPDATE）|
| 入金済 | `invoices` + `reports` 更新（UPDATE）|
| 設定保存 | `settings` テーブル（UPDATE）|

- localStorage は**一切使用しない**
- 起動時に必ず Supabase から最新データを取得
- 通信エラー時はトースト通知でユーザーに失敗を知らせる
- 保存成功時のみ「保存完了」を表示

---

## 将来拡張予定

- [ ] AIによる日報入力補助
- [ ] AIによる請求書チェック
- [ ] CSV・Excel出力
- [ ] 会計ソフト連携（マネーフォワード等）
- [ ] メール自動送信（Resend / SendGrid連携）
