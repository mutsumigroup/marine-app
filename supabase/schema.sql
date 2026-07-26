-- =============================================
-- マリン業務管理システム Supabase スキーマ
-- Supabase SQL Editor で実行してください
-- =============================================

-- 設定テーブル
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  tel TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  invoice_no TEXT NOT NULL DEFAULT '',
  pay_days INTEGER NOT NULL DEFAULT 30,
  bank TEXT NOT NULL DEFAULT '',
  account TEXT NOT NULL DEFAULT '',
  daily_mail TEXT NOT NULL DEFAULT '',
  inv_mail TEXT NOT NULL DEFAULT '',
  prices JSONB NOT NULL DEFAULT '{}',
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  client_annual_goal BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 日報テーブル
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  port TEXT NOT NULL,
  ship TEXT NOT NULL,
  crew INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  work TEXT NOT NULL DEFAULT '',
  amount BIGINT NOT NULL DEFAULT 0,
  park_place TEXT NOT NULL DEFAULT '',
  park_fee BIGINT NOT NULL DEFAULT 0,
  hw_from1 TEXT NOT NULL DEFAULT '',
  hw_to1 TEXT NOT NULL DEFAULT '',
  hw_from2 TEXT NOT NULL DEFAULT '',
  hw_to2 TEXT NOT NULL DEFAULT '',
  hw_fee BIGINT NOT NULL DEFAULT 0,
  meal BIGINT NOT NULL DEFAULT 0,
  other_exp BIGINT NOT NULL DEFAULT 0,
  expenses BIGINT NOT NULL DEFAULT 0,
  voucher TEXT NOT NULL DEFAULT '',
  bill_month TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  invoiced BOOLEAN NOT NULL DEFAULT FALSE,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 請求書テーブル
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  billing_month TEXT NOT NULL,
  subtotal BIGINT NOT NULL DEFAULT 0,
  tax BIGINT NOT NULL DEFAULT 0,
  expenses BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '未請求',
  sent_at TEXT NOT NULL DEFAULT '',
  paid_date TEXT NOT NULL DEFAULT '',
  paid_amt BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- インデックス
CREATE INDEX IF NOT EXISTS idx_reports_bill_month ON reports(bill_month);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_month ON invoices(billing_month);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- RLS（Row Level Security）を無効化（シングルユーザーアプリのため）
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- 初期設定データの挿入（1件のみ）
INSERT INTO settings (
  company_name, address, tel, email, invoice_no, pay_days,
  bank, account, daily_mail, inv_mail, prices,
  client_name, client_email, client_annual_goal
) VALUES (
  '株式会社マリンサービス',
  '〒220-0001 神奈川県横浜市西区みなとみらい1-1',
  '045-000-0000',
  'info@marine-service.co.jp',
  'T1234567890123',
  30,
  '横浜銀行 みなとみらい支店',
  '普通 1234567 カ）マリンサービス',
  'manager@marine-service.co.jp',
  '',
  '{
    "転船": {"ship": 10000, "crew": 1000},
    "センディング": {"ship": 8000, "crew": 800},
    "乗船": {"ship": 10000, "crew": 1000},
    "下船": {"ship": 10000, "crew": 1000},
    "別日の場合の入管手続き": {"ship": 15000, "crew": 0},
    "新横浜・東京駅対応": {"ship": 12000, "crew": 0},
    "その他①": {"ship": 10000, "crew": 1000},
    "その他②": {"ship": 10000, "crew": 1000}
  }',
  '合同会社studio Oliver',
  'oliver@example.com',
  12000000
);
