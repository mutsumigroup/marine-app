// 送迎日報の型定義（既存のReport型とは完全に独立）
export interface TransportReport {
  id: string
  date: string
  from_area: string        // 出発エリア
  to_area: string          // 到着エリア
  fare: number             // 旅客運送手当
  tenko_label: string      // 点呼手当の種類
  tenko_fee: number        // 点呼手当金額
  toll_fee: number         // 高速代・駐車場（立替）
  passengers: string       // 乗客人数
  notes: string            // 備考
  total: number            // 合計手当
  bill_month: string       // 請求対象月
  sent: boolean            // 送信済フラグ
  created_at?: string
  updated_at?: string
}
