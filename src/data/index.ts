import allQuestions from './all.json'
import wordsQuestions from './words_quiz.json'
import type { Question, Deck, HistoryRecord, Report, ExportData, ChapterInfo } from '../types'

// 型アサーション
const BUILTIN_QUESTIONS = allQuestions as Question[]
const WORDS_QUESTIONS = wordsQuestions as Question[]

// ビルトインデッキ: CISSP試験問題
export const BUILTIN_DECK: Deck = {
  id: 'cissp-exam',
  name: 'CISSP試験問題',
  description: `全${BUILTIN_QUESTIONS.length}問`,
  questions: BUILTIN_QUESTIONS,
  isBuiltin: true
}

// ビルトインデッキ: CISSP単語帳
export const WORDS_DECK: Deck = {
  id: 'cissp-words',
  name: 'CISSP単語帳',
  description: `知識問題${WORDS_QUESTIONS.length}問`,
  questions: WORDS_QUESTIONS,
  isBuiltin: true
}

// すべてのビルトインデッキ
export const BUILTIN_DECKS: Deck[] = [BUILTIN_DECK, WORDS_DECK]

// チャプター定義
export const CHAPTERS: ChapterInfo[] = [
  { ch: 1, jp: 'セキュリティとリスクマネジメント', en: 'Security and Risk Management', type: 'domain' },
  { ch: 2, jp: '資産のセキュリティ', en: 'Asset Security', type: 'domain' },
  { ch: 3, jp: 'セキュリティアーキテクチャとエンジニアリング', en: 'Security Architecture and Engineering', type: 'domain' },
  { ch: 4, jp: '通信とネットワークセキュリティ', en: 'Communication and Network Security', type: 'domain' },
  { ch: 5, jp: 'アイデンティティとアクセス管理', en: 'Identity and Access Management', type: 'domain' },
  { ch: 6, jp: 'セキュリティ評価とテスト', en: 'Security Assessment and Testing', type: 'domain' },
  { ch: 7, jp: 'セキュリティ運用', en: 'Security Operations', type: 'domain' },
  { ch: 8, jp: 'ソフトウェア開発セキュリティ', en: 'Software Development Security', type: 'domain' },
  { ch: 9, jp: '模擬試験1', en: 'Practice Exam 1', type: 'exam' },
  { ch: 10, jp: '模擬試験2', en: 'Practice Exam 2', type: 'exam' },
  { ch: 11, jp: '模擬試験3', en: 'Practice Exam 3', type: 'exam' },
  { ch: 12, jp: '模擬試験4', en: 'Practice Exam 4', type: 'exam' }
]

// localStorageキー
const STORAGE_KEYS = {
  HISTORY: 'cissp-history-v1',
  STARRED: 'cissp-starred-v1',
  REPORTS: 'cissp-reports-v1',
  CUSTOM_DECKS: 'cissp-custom-decks-v1',
  SETTINGS: 'cissp-settings-v1'
} as const

// ========== カスタムデッキ管理 ==========

export function getCustomDecks(): Deck[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_DECKS)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveCustomDecks(decks: Deck[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_DECKS, JSON.stringify(decks))
  } catch (e) {
    console.error('Failed to save custom decks:', e)
  }
}

export function addCustomDeck(name: string, questions: Question[]): Deck {
  const deck: Deck = {
    id: `custom-${Date.now()}`,
    name,
    description: `${questions.length}問`,
    questions,
    isBuiltin: false,
    createdAt: new Date().toISOString()
  }
  const decks = getCustomDecks()
  decks.push(deck)
  saveCustomDecks(decks)
  return deck
}

export function removeCustomDeck(deckId: string): void {
  const decks = getCustomDecks().filter(d => d.id !== deckId)
  saveCustomDecks(decks)
}

export function getAllDecks(): Deck[] {
  return [...BUILTIN_DECKS, ...getCustomDecks()]
}

export function getDeckById(deckId: string): Deck | undefined {
  return getAllDecks().find(d => d.id === deckId)
}

// ========== 履歴管理 ==========

export function getHistory(): Record<string, HistoryRecord[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export function saveHistory(history: Record<string, HistoryRecord[]>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history))
  } catch (e) {
    console.error('Failed to save history:', e)
  }
}

// ========== スター管理 ==========

export function getStarred(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.STARRED)
    return new Set(stored ? JSON.parse(stored) : [])
  } catch {
    return new Set()
  }
}

export function saveStarred(starred: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STARRED, JSON.stringify([...starred]))
  } catch (e) {
    console.error('Failed to save starred:', e)
  }
}

// ========== 誤り報告管理 ==========

export function getReports(): Record<string, Report> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.REPORTS)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export function saveReports(reports: Record<string, Report>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports))
  } catch (e) {
    console.error('Failed to save reports:', e)
  }
}

// ========== 設定管理 ==========

export interface Settings {
  showEn: boolean
  activeDeckId: string
}

export function getSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    return stored ? JSON.parse(stored) : { showEn: false, activeDeckId: BUILTIN_DECK.id }
  } catch {
    return { showEn: false, activeDeckId: BUILTIN_DECK.id }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

// ========== エクスポート/インポート ==========

export function exportAllData(): ExportData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    history: getHistory(),
    starred: [...getStarred()],
    reports: getReports(),
    customDecks: getCustomDecks(),
    settings: getSettings()
  }
}

export function importAllData(data: ExportData, merge: boolean = false): void {
  if (data.version !== 1) {
    throw new Error('Unsupported export version')
  }

  if (merge) {
    // マージモード: 既存データと統合
    const currentHistory = getHistory()
    const newHistory = { ...currentHistory }
    for (const [key, records] of Object.entries(data.history)) {
      if (newHistory[key]) {
        // 既存の履歴と新しい履歴を統合（重複は除去）
        const existingTs = new Set(newHistory[key].map(r => r.ts))
        const newRecords = records.filter(r => !existingTs.has(r.ts))
        newHistory[key] = [...newHistory[key], ...newRecords].slice(-20)
      } else {
        newHistory[key] = records.slice(-20)
      }
    }
    saveHistory(newHistory)

    const currentStarred = getStarred()
    data.starred.forEach(s => currentStarred.add(s))
    saveStarred(currentStarred)

    const currentReports = getReports()
    saveReports({ ...currentReports, ...data.reports })

    const currentDecks = getCustomDecks()
    const existingIds = new Set(currentDecks.map(d => d.id))
    const newDecks = data.customDecks.filter(d => !existingIds.has(d.id))
    saveCustomDecks([...currentDecks, ...newDecks])
  } else {
    // 上書きモード
    saveHistory(data.history)
    saveStarred(new Set(data.starred))
    saveReports(data.reports)
    saveCustomDecks(data.customDecks)
  }

  if (data.settings) {
    saveSettings(data.settings)
  }
}

// ========== ユーティリティ ==========

export function getQuestionId(deckId: string, question: Question): string {
  return `${deckId}-${question.chapter}-${question.id}`
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}
