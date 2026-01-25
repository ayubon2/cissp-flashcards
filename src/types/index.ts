// 選択肢の型
export interface QuestionOption {
  label: string
  text_jp: string
  text_en: string
}

// 問題の型
export interface Question {
  chapter: number
  domain_jp: string
  domain_en: string
  id: number
  question_jp: string
  question_en: string
  options: QuestionOption[]
  answer: string
  explanation_jp: string
  explanation_en: string
  tags_jp: string[]
  tags_en: string[]
  difficulty: 'easy' | 'medium' | 'hard'
}

// デッキの型
export interface Deck {
  id: string
  name: string
  description?: string
  questions: Question[]
  isBuiltin: boolean
  createdAt?: string
}

// 回答履歴の型
export interface HistoryRecord {
  ts: number
  correct: boolean
  selected: string
}

// 誤り報告の型
export interface Report {
  memo: string
  ts: number
}

// フィルター設定の型
export interface FilterState {
  mode: 'all' | 'chapter' | 'tag' | 'type'
  chapter: number | null
  tags: string[]
  starredOnly: boolean
  chapterType: 'domain' | 'exam'
  historyFilter: 'all' | 'unanswered' | 'wrong' | 'learning' | 'mastered'
}

// セッション統計の型
export interface SessionStats {
  total: number
  correct: number
}

// 誤り報告モーダルの型
export interface ReportModal {
  open: boolean
  qId: string | null
  memo: string
}

// エクスポートデータの型
export interface ExportData {
  version: number
  exportedAt: string
  history: Record<string, HistoryRecord[]>
  starred: string[]
  reports: Record<string, Report>
  customDecks: Deck[]
  settings?: {
    showEn: boolean
    activeDeckId: string
  }
}

// チャプター定義の型
export interface ChapterInfo {
  ch: number
  jp: string
  en: string
  type: 'domain' | 'exam'
}
