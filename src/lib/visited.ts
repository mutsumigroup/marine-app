// クリックして開いたことがある行を記録し、一覧上で薄いグレーの「既読マーク」として表示するためのヘルパー。
// localStorageに保存するのでページを再読み込みしても残る。
// namespaceごとに別々のキーで保存する（日報一覧と送迎日報一覧で混ざらないように）。

const keyFor = (namespace: string) => `marine_visited_${namespace}`

export function loadVisited(namespace: string): Set<string> {
  try {
    const raw = localStorage.getItem(keyFor(namespace))
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function saveVisited(namespace: string, ids: Set<string>) {
  try {
    localStorage.setItem(keyFor(namespace), JSON.stringify(Array.from(ids)))
  } catch {
    // localStorageが使えない環境では無視
  }
}

/** 既読行の「跡」として使う色 */
export const VISITED_BG = '#f1f5f9'
