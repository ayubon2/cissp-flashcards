import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronLeft, Shield, Check, X, Globe, RotateCcw, BookOpen, BarChart3, Upload, Download, Trash2, Plus, Database, AlertCircle, CheckCircle, Star, Flag, FileText, Package, ChevronDown, ChevronUp } from 'lucide-react'

const APP_VERSION = '3.1.0'
import type { Question, Deck, FilterState, SessionStats, ReportModal, HistoryRecord, Report, ExportData } from './types'
import {
  BUILTIN_DECK,
  CHAPTERS,
  getAllDecks,
  addCustomDeck,
  removeCustomDeck,
  getHistory,
  saveHistory,
  getStarred,
  saveStarred,
  getReports,
  saveReports,
  getSettings,
  saveSettings,
  exportAllData,
  importAllData,
  getQuestionId
} from './data'

const getQid = (deckId: string, q: Question) => getQuestionId(deckId, q)

export default function CISSPQuizApp() {
  const [view, setView] = useState<'home' | 'quiz' | 'summary' | 'stats' | 'import' | 'reports' | 'decks'>('home')
  const [activeDeck, setActiveDeck] = useState<Deck>(BUILTIN_DECK)
  const [quizQueue, setQuizQueue] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showEn, setShowEn] = useState(false)
  const [history, setHistory] = useState<Record<string, HistoryRecord[]>>({})
  const [starred, setStarred] = useState<Set<string>>(new Set())
  const [reports, setReports] = useState<Record<string, Report>>({})
  const [filters, setFilters] = useState<FilterState>({
    mode: 'all',
    chapter: null,
    tags: [],
    starredOnly: false,
    chapterType: 'domain',
    historyFilter: 'all'
  })
  const [session, setSession] = useState<SessionStats>({ total: 0, correct: 0 })
  const [importText, setImportText] = useState('')
  const [logs, setLogs] = useState<Array<{ type: string; msg: string }>>([])
  const [reportModal, setReportModal] = useState<ReportModal>({ open: false, qId: null, memo: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deckSelectorOpen, setDeckSelectorOpen] = useState(false)
  const [importMode, setImportMode] = useState<'questions' | 'data'>('questions')

  // 初期データ読み込み
  useEffect(() => {
    const loadData = () => {
      try {
        setHistory(getHistory())
        setStarred(getStarred())
        setReports(getReports())
        const settings = getSettings()
        setShowEn(settings.showEn)
        const deck = getAllDecks().find(d => d.id === settings.activeDeckId)
        if (deck) setActiveDeck(deck)
      } catch (e) {
        console.error('Failed to load data:', e)
      }
      setIsLoading(false)
    }
    loadData()
  }, [])

  // 設定保存
  useEffect(() => {
    if (!isLoading) {
      saveSettings({ showEn, activeDeckId: activeDeck.id })
    }
  }, [showEn, activeDeck.id, isLoading])

  const questions = activeDeck.questions

  const getHistoryStatus = (qid: string) => {
    const h = history[qid]
    if (!h || h.length === 0) return 'unanswered'
    const last2 = h.slice(-2)
    const lastCorrect = last2[last2.length - 1]?.correct
    const last2Correct = last2.length >= 2 && last2.every(r => r.correct)
    if (last2Correct) return 'mastered'
    if (!lastCorrect) return 'wrong'
    return 'learning'
  }

  const getHistoryCounts = () => {
    let unanswered = 0, wrong = 0, learning = 0, mastered = 0
    questions.forEach(q => {
      const status = getHistoryStatus(getQid(activeDeck.id, q))
      if (status === 'unanswered') unanswered++
      else if (status === 'wrong') wrong++
      else if (status === 'learning') learning++
      else if (status === 'mastered') mastered++
    })
    return { unanswered, wrong, learning, mastered }
  }

  const allTags = useMemo(() => {
    return [...new Set(questions.flatMap(q => showEn ? (q.tags_en || q.tags_jp || []) : (q.tags_jp || q.tags_en || [])))]
  }, [questions, showEn])

  const domainChapters = CHAPTERS.filter(c => c.type === 'domain')
  const examChapters = CHAPTERS.filter(c => c.type === 'exam')

  const log = (type: string, msg: string) => setLogs(prev => [...prev, { type, msg }])

  const toggleStar = (qId: string) => {
    const ns = new Set(starred)
    if (ns.has(qId)) ns.delete(qId)
    else ns.add(qId)
    setStarred(ns)
    saveStarred(ns)
  }

  const submitReport = () => {
    if (!reportModal.qId) return
    const nr = { ...reports, [reportModal.qId]: { memo: reportModal.memo, ts: Date.now() } }
    setReports(nr)
    saveReports(nr)
    setReportModal({ open: false, qId: null, memo: '' })
  }

  const removeReport = (qId: string) => {
    const nr = { ...reports }
    delete nr[qId]
    setReports(nr)
    saveReports(nr)
  }

  const validate = (q: unknown, idx: number) => {
    const e: string[] = []
    const question = q as Partial<Question>
    if (question.chapter === undefined || question.chapter < 1 || question.chapter > 12) e.push(`[${idx}] chapter 1-12`)
    if (question.id === undefined) e.push(`[${idx}] id required`)
    if (!question.question_jp && !question.question_en) e.push(`[${idx}] question required`)
    if (!Array.isArray(question.options)) e.push(`[${idx}] options must be array`)
    if (!question.answer) e.push(`[${idx}] answer required`)
    return e
  }

  const isMatchingQuestion = (q: Question) => {
    return q.options.length <= 1 || (q.answer && q.answer.includes('-'))
  }

  const handleImportQuestions = () => {
    setLogs([])
    log('INFO', 'Import start...')
    try {
      const data = JSON.parse(importText)
      const arr = Array.isArray(data) ? data : [data]
      log('INFO', `Parsed ${arr.length} items`)
      const errs: string[] = []
      arr.forEach((q, i) => {
        const e = validate(q, i)
        if (e.length) { e.forEach(x => log('ERROR', x)); errs.push(...e) }
        else log('OK', `[${i}] ch${q.chapter}-${q.id} OK`)
      })
      if (errs.length) { log('ERROR', `${errs.length} errors`); return }
      const proc = arr.map(q => ({
        ...q,
        type: q.type || 'single',
        tags_jp: q.tags_jp || [],
        tags_en: q.tags_en || [],
        why_not: q.why_not || {},
        difficulty: q.difficulty || 'medium'
      })) as Question[]

      // 新しいデッキとして追加
      const deckName = `Import ${new Date().toLocaleDateString()}`
      const newDeck = addCustomDeck(deckName, proc)
      setActiveDeck(newDeck)
      log('SUCCESS', `Done: Created deck "${deckName}" with ${proc.length} questions`)
      setImportText('')
    } catch (e) {
      log('ERROR', `Parse: ${(e as Error).message}`)
    }
  }

  const handleImportData = () => {
    setLogs([])
    log('INFO', 'Importing data...')
    try {
      const data = JSON.parse(importText) as ExportData
      if (data.version !== 1) {
        log('ERROR', 'Unsupported export version')
        return
      }
      importAllData(data, true) // マージモード
      // 状態を再読み込み
      setHistory(getHistory())
      setStarred(getStarred())
      setReports(getReports())
      log('SUCCESS', 'Data imported successfully!')
      setImportText('')
    } catch (e) {
      log('ERROR', `Import failed: ${(e as Error).message}`)
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = (ev) => setImportText(ev.target?.result as string)
    r.readAsText(f)
  }

  const handleExportQuestions = () => {
    const b = new Blob([JSON.stringify(activeDeck.questions, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = `${activeDeck.name}-questions.json`
    a.click()
  }

  const handleExportAllData = () => {
    const data = exportAllData()
    const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = `cissp-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
  }

  const startQuiz = () => {
    let f = [...questions]
    if (filters.mode === 'chapter' && filters.chapter) f = f.filter(q => q.chapter === filters.chapter)
    else if (filters.mode === 'tag' && filters.tags.length) f = f.filter(q => filters.tags.some(t => (showEn ? q.tags_en : q.tags_jp || []).includes(t)))
    else if (filters.mode === 'type') f = f.filter(q => filters.chapterType === 'domain' ? q.chapter <= 8 : q.chapter >= 9)
    if (filters.starredOnly) f = f.filter(q => starred.has(getQid(activeDeck.id, q)))
    if (filters.historyFilter !== 'all') f = f.filter(q => getHistoryStatus(getQid(activeDeck.id, q)) === filters.historyFilter)
    f.sort(() => Math.random() - 0.5)
    if (!f.length) { alert('対象の問題がありません'); return }
    setQuizQueue(f)
    setCurrentIdx(0)
    setSelected(null)
    setShowResult(false)
    setSession({ total: 0, correct: 0 })
    setView('quiz')
  }

  const submitAnswer = () => {
    const q = quizQueue[currentIdx]
    const isMatching = isMatchingQuestion(q)
    const sel = isMatching ? q.answer : selected
    if (sel === null) return
    if (isMatching) setSelected(q.answer)
    const qid = getQid(activeDeck.id, q)
    const ok = sel === q.answer
    const nh = { ...history, [qid]: [...(history[qid] || []), { ts: Date.now(), correct: ok, selected: sel }].slice(-20) }
    setHistory(nh)
    saveHistory(nh)
    setSession(s => ({ total: s.total + 1, correct: s.correct + (ok ? 1 : 0) }))
    setShowResult(true)
  }

  const nextQ = () => {
    if (currentIdx < quizQueue.length - 1) {
      setCurrentIdx(i => i + 1)
      setSelected(null)
      setShowResult(false)
    } else setView('summary')
  }

  const getDomainLabel = (q: Question, lang: 'jp' | 'en') => lang === 'en' ? (q.domain_en || q.domain_jp || '') : (q.domain_jp || q.domain_en || '')

  // ローディング画面
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="p-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-lg shadow-amber-500/20 inline-block mb-4">
            <Shield className="text-slate-900 animate-pulse" size={32} />
          </div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  // デッキ管理画面
  if (view === 'decks') {
    const decks = getAllDecks()
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-lg transition"><ChevronLeft size={24} /></button>
            <h1 className="text-xl font-bold">Deck Management</h1>
          </div>
          <div className="space-y-3">
            {decks.map(deck => (
              <div key={deck.id} className={`bg-slate-800/50 backdrop-blur rounded-xl p-4 border ${activeDeck.id === deck.id ? 'border-amber-500' : 'border-slate-700/50'}`}>
                <div className="flex items-start justify-between">
                  <button onClick={() => { setActiveDeck(deck); setView('home') }} className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <Package size={16} className={activeDeck.id === deck.id ? 'text-amber-400' : 'text-slate-400'} />
                      <span className="font-medium">{deck.name}</span>
                      {deck.isBuiltin && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Built-in</span>}
                    </div>
                    <p className="text-sm text-slate-400">{deck.questions.length} questions</p>
                  </button>
                  {!deck.isBuiltin && (
                    <button onClick={() => { removeCustomDeck(deck.id); if (activeDeck.id === deck.id) setActiveDeck(BUILTIN_DECK) }}
                      className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setImportMode('questions'); setView('import') }}
            className="w-full mt-4 py-4 bg-slate-800/50 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-700/50 transition border-2 border-dashed border-slate-600">
            <Plus size={20} className="text-green-400" /> Import new deck
          </button>
        </div>
      </div>
    )
  }

  // HOME
  if (view === 'home') {
    const starCnt = [...starred].filter(id => questions.some(q => getQid(activeDeck.id, q) === id)).length
    const repCnt = Object.keys(reports).length
    const domainQs = questions.filter(q => q.chapter <= 8).length
    const examQs = questions.filter(q => q.chapter >= 9).length
    const hCounts = getHistoryCounts()

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-center gap-4 py-8">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-lg shadow-amber-500/20">
              <Shield className="text-slate-900" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent">
                CISSP Quiz <span className="text-base font-normal text-slate-500">v{APP_VERSION}</span>
              </h1>
              <p className="text-slate-400 text-sm">Security Certification Study App</p>
            </div>
          </div>

          {/* デッキ選択 */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-4 mb-4 border border-slate-700/50">
            <button onClick={() => setDeckSelectorOpen(!deckSelectorOpen)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package size={18} className="text-amber-400" />
                <div className="text-left">
                  <p className="text-sm text-slate-400">Active Deck</p>
                  <p className="font-medium">{activeDeck.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm bg-slate-700 px-3 py-1 rounded-full">{questions.length}</span>
                {deckSelectorOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>
            {deckSelectorOpen && (
              <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                {getAllDecks().map(deck => (
                  <button key={deck.id}
                    onClick={() => { setActiveDeck(deck); setDeckSelectorOpen(false) }}
                    className={`w-full p-3 rounded-xl text-left text-sm transition-all flex items-center justify-between ${activeDeck.id === deck.id ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-slate-700/30 hover:bg-slate-700/50'}`}>
                    <div className="flex items-center gap-2">
                      {activeDeck.id === deck.id && <Check size={16} className="text-amber-400" />}
                      <span>{deck.name}</span>
                      {deck.isBuiltin && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Built-in</span>}
                    </div>
                    <span className="text-slate-400">{deck.questions.length}</span>
                  </button>
                ))}
                <button onClick={() => setView('decks')}
                  className="w-full p-3 rounded-xl text-sm text-slate-400 hover:bg-slate-700/30 transition flex items-center justify-center gap-2">
                  <Plus size={16} /> Manage decks
                </button>
              </div>
            )}
          </div>

          {/* 進捗率表示 */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-4 mb-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400 font-medium">Progress</p>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-lg font-bold text-green-400">
                  {questions.length > 0 ? Math.round((hCounts.mastered / questions.length) * 100) : 0}%
                </span>
                <span className="text-sm text-slate-500">
                  ({hCounts.mastered}/{questions.length})
                </span>
              </div>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                  style={{ width: `${questions.length > 0 ? (hCounts.mastered / questions.length) * 100 : 0}%` }}
                />
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${questions.length > 0 ? (hCounts.learning / questions.length) * 100 : 0}%` }}
                />
                <div
                  className="bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
                  style={{ width: `${questions.length > 0 ? (hCounts.wrong / questions.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> Mastered: {hCounts.mastered}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Learning: {hCounts.learning}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> Wrong: {hCounts.wrong}</span>
            </div>
          </div>

          <div className="flex justify-center gap-6 text-sm mb-6">
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-full">
              <Database size={16} className="text-blue-400" />
              <span className="font-medium">{questions.length}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-full">
              <Star size={16} className="text-yellow-400" fill="currentColor" />
              <span className="font-medium">{starCnt}</span>
            </div>
            {repCnt > 0 && (
              <div className="flex items-center gap-2 bg-red-900/30 px-4 py-2 rounded-full">
                <Flag size={16} className="text-red-400" />
                <span className="font-medium text-red-300">{repCnt}</span>
              </div>
            )}
          </div>

          {/* 出題範囲 */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-4 border border-slate-700/50">
            <p className="text-sm text-slate-400 mb-4 font-medium">Quiz Scope</p>
            <div className="grid grid-cols-4 gap-2">
              {(['all', 'type', 'chapter', 'tag'] as const).map(m => (
                <button key={m} onClick={() => setFilters(f => ({ ...f, mode: m, chapter: null, tags: [] }))}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${filters.mode === m ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 shadow-lg' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                  {m === 'all' ? 'All' : m === 'type' ? 'Type' : m === 'chapter' ? 'Ch.' : 'Tag'}
                </button>
              ))}
            </div>
          </div>

          {filters.mode === 'type' && (
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-4 border border-slate-700/50">
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setFilters(f => ({ ...f, chapterType: 'domain' }))}
                  className={`p-5 rounded-xl text-center transition-all ${filters.chapterType === 'domain' ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-slate-900 shadow-lg' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                  <BookOpen size={28} className="mx-auto mb-2" />
                  <p className="font-bold">Domain</p>
                  <p className="text-xs opacity-70 mt-1">Ch.1-8 ({domainQs})</p>
                </button>
                <button onClick={() => setFilters(f => ({ ...f, chapterType: 'exam' }))}
                  className={`p-5 rounded-xl text-center transition-all ${filters.chapterType === 'exam' ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-slate-900 shadow-lg' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                  <FileText size={28} className="mx-auto mb-2" />
                  <p className="font-bold">Practice</p>
                  <p className="text-xs opacity-70 mt-1">Ch.9-12 ({examQs})</p>
                </button>
              </div>
            </div>
          )}

          {filters.mode === 'chapter' && (
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-3 font-medium">Domain (Ch.1-8)</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {domainChapters.map(c => {
                  const cnt = questions.filter(q => q.chapter === c.ch).length
                  return (
                    <button key={c.ch} onClick={() => setFilters(f => ({ ...f, chapter: c.ch }))}
                      className={`p-3 rounded-xl text-left text-sm transition-all ${filters.chapter === c.ch ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 shadow-lg' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Ch.{c.ch}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-black/20">{cnt}</span>
                      </div>
                      <p className="text-xs mt-1 opacity-80 truncate">{showEn ? c.en : c.jp}</p>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500 mb-3 font-medium">Practice Exam (Ch.9-12)</p>
              <div className="grid grid-cols-2 gap-2">
                {examChapters.map(c => {
                  const cnt = questions.filter(q => q.chapter === c.ch).length
                  return (
                    <button key={c.ch} onClick={() => setFilters(f => ({ ...f, chapter: c.ch }))}
                      className={`p-3 rounded-xl text-left text-sm transition-all ${filters.chapter === c.ch ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 shadow-lg' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Ch.{c.ch}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-black/20">{cnt}</span>
                      </div>
                      <p className="text-xs mt-1 opacity-80">{showEn ? c.en : c.jp}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {filters.mode === 'tag' && allTags.length > 0 && (
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-4 border border-slate-700/50">
              <div className="flex flex-wrap gap-2">
                {allTags.map(t => (
                  <button key={t} onClick={() => setFilters(f => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t] }))}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${filters.tags.includes(t) ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 学習状況 */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-4 border border-slate-700/50">
            <p className="text-sm text-slate-400 mb-4 font-medium">Filter by Progress</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { key: 'all' as const, icon: 'list', count: questions.length, label: 'All', color: 'from-slate-500 to-slate-600', active: filters.historyFilter === 'all' && !filters.starredOnly },
                { key: 'wrong' as const, icon: 'x', count: hCounts.wrong, label: 'Wrong', color: 'from-red-500 to-red-600', active: filters.historyFilter === 'wrong' },
                { key: 'unanswered' as const, icon: 'new', count: hCounts.unanswered, label: 'New', color: 'from-blue-500 to-blue-600', active: filters.historyFilter === 'unanswered' },
                { key: 'learning' as const, icon: 'book', count: hCounts.learning, label: 'Learning', color: 'from-amber-500 to-orange-500', active: filters.historyFilter === 'learning' },
                { key: 'starred' as const, icon: 'star', count: starCnt, label: 'Starred', color: 'from-yellow-400 to-amber-500', active: filters.starredOnly }
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.key === 'all') setFilters(f => ({ ...f, historyFilter: 'all', starredOnly: false }))
                    else if (item.key === 'starred') setFilters(f => ({ ...f, starredOnly: !f.starredOnly, historyFilter: 'all' }))
                    else setFilters(f => ({ ...f, historyFilter: f.historyFilter === item.key ? 'all' : item.key, starredOnly: false }))
                  }}
                  className={`p-2 rounded-xl text-center transition-all ${item.active ? `bg-gradient-to-br ${item.color} shadow-lg scale-105` : 'bg-slate-700/50 hover:bg-slate-700'}`}
                >
                  <span className="text-lg">{item.icon === 'list' ? '📋' : item.icon === 'x' ? '❌' : item.icon === 'new' ? '🆕' : item.icon === 'book' ? '📖' : '⭐'}</span>
                  <p className="text-base font-bold mt-0.5">{item.count}</p>
                  <p className="text-xs opacity-70 truncate">{item.label}</p>
                </button>
              ))}
            </div>
          </div>

          <button onClick={startQuiz}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-2xl text-lg flex items-center justify-center gap-3 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <BookOpen size={24} /> Start Quiz
          </button>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <button onClick={() => setView('stats')} className="py-4 bg-slate-800/50 rounded-xl flex flex-col items-center gap-1 hover:bg-slate-700/50 transition border border-slate-700/50">
              <BarChart3 size={20} className="text-blue-400" />
              <span className="text-xs text-slate-400">Stats</span>
            </button>
            <button onClick={() => { setLogs([]); setImportMode('questions'); setView('import') }} className="py-4 bg-slate-800/50 rounded-xl flex flex-col items-center gap-1 hover:bg-slate-700/50 transition border border-slate-700/50">
              <Upload size={20} className="text-green-400" />
              <span className="text-xs text-slate-400">Import</span>
            </button>
            <button onClick={() => setView('reports')} className="py-4 bg-slate-800/50 rounded-xl flex flex-col items-center gap-1 hover:bg-slate-700/50 transition border border-slate-700/50 relative">
              <Flag size={20} className="text-red-400" />
              <span className="text-xs text-slate-400">Reports</span>
              {repCnt > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{repCnt}</span>}
            </button>
          </div>

          <button onClick={() => setShowEn(!showEn)}
            className="w-full mt-4 py-3 bg-slate-800/50 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-slate-700/50 transition border border-slate-700/50">
            <Globe size={18} className={showEn ? 'text-blue-400' : 'text-slate-400'} />
            {showEn ? 'English Mode' : 'Japanese Mode'}
          </button>
        </div>
      </div>
    )
  }

  // REPORTS
  if (view === 'reports') {
    const rqs = questions.filter(q => reports[getQid(activeDeck.id, q)])
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-lg transition"><ChevronLeft size={24} /></button>
            <h1 className="text-xl font-bold">Error Reports</h1>
            <span className="ml-auto text-sm bg-red-900/50 text-red-300 px-3 py-1 rounded-full">{Object.keys(reports).length}</span>
          </div>
          {rqs.length === 0 ? (
            <div className="text-center py-16">
              <Flag size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-500">No reports</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rqs.map(q => {
                const qid = getQid(activeDeck.id, q)
                return (
                  <div key={qid} className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs bg-slate-700 px-2 py-1 rounded-lg font-medium">Ch.{q.chapter}-{q.id}</span>
                      <button onClick={() => removeReport(qid)} className="text-slate-500 hover:text-red-400 transition p-1"><X size={16} /></button>
                    </div>
                    <p className="text-sm mb-2">{showEn ? q.question_en : q.question_jp}</p>
                    <p className="text-xs text-slate-500">Answer: <span className="text-green-400 font-bold">{q.answer}</span></p>
                    {reports[qid]?.memo && (
                      <div className="bg-red-900/30 rounded-lg p-3 mt-3 border border-red-500/30">
                        <p className="text-sm text-red-200">{reports[qid].memo}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={() => { setReports({}); saveReports({}) }} disabled={!Object.keys(reports).length}
            className="w-full mt-6 py-3 bg-red-900/30 text-red-400 rounded-xl text-sm disabled:opacity-30 hover:bg-red-900/50 transition border border-red-500/30">
            Clear All
          </button>
        </div>
      </div>
    )
  }

  // IMPORT
  if (view === 'import') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-lg transition"><ChevronLeft size={24} /></button>
            <h1 className="text-xl font-bold">Import</h1>
          </div>

          {/* モード切替 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setImportMode('questions')}
              className={`py-3 rounded-xl text-sm font-medium transition-all ${importMode === 'questions' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900' : 'bg-slate-700/50'}`}>
              New Deck
            </button>
            <button onClick={() => setImportMode('data')}
              className={`py-3 rounded-xl text-sm font-medium transition-all ${importMode === 'data' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900' : 'bg-slate-700/50'}`}>
              Restore Data
            </button>
          </div>

          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-4 border border-slate-700/50">
            <p className="text-sm text-slate-400 mb-3">
              {importMode === 'questions' ? 'Import questions JSON to create a new deck' : 'Restore history, stars, and custom decks from backup'}
            </p>
            <input type="file" accept=".json" ref={fileRef} onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="w-full py-4 bg-slate-700/50 rounded-xl flex items-center justify-center gap-2 text-sm mb-4 hover:bg-slate-700 transition border-2 border-dashed border-slate-600">
              <Upload size={20} className="text-green-400" /> Select JSON file
            </button>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Or paste JSON here..."
              className="w-full h-40 bg-slate-900/50 rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 border border-slate-700/50" />
          </div>
          {logs.length > 0 && (
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-4 mb-4 max-h-48 overflow-y-auto border border-slate-700/50">
              <div className="space-y-1 text-xs font-mono">
                {logs.map((l, i) => (
                  <div key={i} className={`flex items-start gap-2 ${l.type === 'ERROR' ? 'text-red-400' : l.type === 'SUCCESS' ? 'text-green-400' : l.type === 'OK' ? 'text-blue-400' : 'text-slate-300'}`}>
                    {l.type === 'ERROR' ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : (l.type === 'SUCCESS' || l.type === 'OK') ? <CheckCircle size={12} className="mt-0.5 shrink-0" /> : null}
                    <span>{l.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={importMode === 'questions' ? handleImportQuestions : handleImportData} disabled={!importText.trim()}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-xl disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30">
            <Plus size={20} /> {importMode === 'questions' ? 'Create Deck' : 'Restore Data'}
          </button>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={handleExportQuestions} className="py-3 bg-slate-800/50 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-slate-700/50 transition border border-slate-700/50">
              <Download size={18} className="text-blue-400" /> Export Deck
            </button>
            <button onClick={handleExportAllData}
              className="py-3 bg-slate-800/50 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-slate-700/50 transition border border-slate-700/50">
              <Download size={18} className="text-green-400" /> Backup All
            </button>
          </div>
        </div>
      </div>
    )
  }

  // QUIZ
  if (view === 'quiz' && quizQueue.length > 0) {
    const q = quizQueue[currentIdx]
    const qid = getQid(activeDeck.id, q)
    const isStar = starred.has(qid)
    const isRep = !!reports[qid]
    const tags = showEn ? (q.tags_en || q.tags_jp || []) : (q.tags_jp || q.tags_en || [])

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 flex flex-col">
        {reportModal.open && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Flag size={20} className="text-red-400" />Report Error</h3>
              <p className="text-sm text-slate-400 mb-4">ID: {reportModal.qId}</p>
              <textarea value={reportModal.memo} onChange={e => setReportModal(m => ({ ...m, memo: e.target.value }))}
                placeholder="What's wrong with this question?" className="w-full h-28 bg-slate-900 rounded-xl p-4 text-sm resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-red-500/50" />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setReportModal({ open: false, qId: null, memo: '' })} className="py-3 bg-slate-700 rounded-xl hover:bg-slate-600 transition">Cancel</button>
                <button onClick={submitReport} className="py-3 bg-red-600 rounded-xl font-medium hover:bg-red-500 transition">Submit</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-lg transition"><ChevronLeft size={24} /></button>
          <span className="text-sm bg-slate-800/50 px-4 py-2 rounded-full font-medium">{currentIdx + 1} / {quizQueue.length}</span>
          <div className="flex items-center gap-2">
            {isRep && <Flag size={16} className="text-red-400" />}
            <button onClick={() => toggleStar(qid)} className="p-2 hover:bg-slate-800 rounded-lg transition">
              <Star size={20} className={isStar ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500'} />
            </button>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full font-medium">Ch.{q.chapter}</span>
          </div>
        </div>

        <div className="h-1.5 bg-slate-800 rounded-full mb-6 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300" style={{ width: `${((currentIdx + 1) / quizQueue.length) * 100}%` }} />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-4 border border-slate-700/50">
            <p className="text-xs text-amber-400/70 mb-2 font-medium">{getDomainLabel(q, showEn ? 'en' : 'jp')}</p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map(t => <span key={t} className="text-xs bg-slate-700/50 px-3 py-1 rounded-full">{t}</span>)}
              </div>
            )}
            <p className="text-lg leading-relaxed whitespace-pre-wrap">{showEn ? (q.question_en || q.question_jp) : q.question_jp}</p>
          </div>

          {q.options.length === 1 ? (
            <div className="mb-4">
              {showResult ? (
                <div className="bg-green-900/30 border-2 border-green-500/50 rounded-2xl p-5">
                  <p className="text-sm text-green-400 mb-2 font-medium">Correct Answer:</p>
                  <p className="text-lg whitespace-pre-line">{showEn ? (q.options[0].text_en || q.options[0].text_jp) : q.options[0].text_jp}</p>
                </div>
              ) : (
                <div className="bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-2xl p-8 text-center">
                  <p className="text-slate-400 font-medium">Matching Question</p>
                  <p className="text-sm text-slate-500 mt-2">Press "Show Answer" below</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {q.options.map(opt => {
                let cls = 'bg-slate-800/50 border-2 border-slate-700/50'
                if (showResult) {
                  if (opt.label === q.answer) cls = 'bg-green-900/30 border-2 border-green-500'
                  else if (opt.label === selected) cls = 'bg-red-900/30 border-2 border-red-500'
                } else if (selected === opt.label) cls = 'bg-amber-500/20 border-2 border-amber-500'
                return (
                  <button key={opt.label} onClick={() => !showResult && setSelected(opt.label)} disabled={showResult}
                    className={`w-full p-4 rounded-xl text-left transition-all ${cls}`}>
                    <div className="flex items-start gap-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        showResult && opt.label === q.answer ? 'bg-green-500 text-white' :
                        showResult && opt.label === selected ? 'bg-red-500 text-white' :
                        selected === opt.label ? 'bg-amber-500 text-slate-900' : 'bg-slate-700'}`}>
                        {showResult && opt.label === q.answer ? <Check size={16} /> : showResult && opt.label === selected ? <X size={16} /> : opt.label}
                      </span>
                      <span className="pt-1">{showEn ? (opt.text_en || opt.text_jp) : opt.text_jp}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <button onClick={() => setShowEn(!showEn)}
            className={`py-3 rounded-xl flex items-center justify-center gap-2 text-sm mb-4 transition ${showEn ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300' : 'bg-slate-800/50 border border-slate-700/50'}`}>
            <Globe size={18} />{showEn ? 'English' : 'Japanese'}
          </button>

          {showResult && (
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <div className={`flex items-center gap-3 ${selected === q.answer ? 'text-green-400' : 'text-red-400'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selected === q.answer ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {selected === q.answer ? <Check size={24} /> : <X size={24} />}
                  </div>
                  <span className="text-xl font-bold">{selected === q.answer ? 'Correct!' : 'Incorrect'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleStar(qid)} className={`p-2 rounded-lg transition ${isStar ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400 hover:text-yellow-400'}`}>
                    <Star size={18} fill={isStar ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={() => setReportModal({ open: true, qId: qid, memo: '' })}
                    className={`p-2 rounded-lg transition ${isRep ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400 hover:text-red-400'}`}>
                    <Flag size={18} />
                  </button>
                </div>
              </div>
              <div className="border-t border-slate-700/50 pt-4">
                <p className="text-sm text-slate-400 mb-2 font-medium">Explanation</p>
                <p className="text-sm leading-relaxed mb-4 whitespace-pre-wrap">{showEn ? (q.explanation_en || q.explanation_jp || '') : (q.explanation_jp || q.explanation_en || '')}</p>
              </div>
            </div>
          )}

          {!showResult ? (
            <button onClick={submitAnswer} disabled={selected === null && !isMatchingQuestion(q)}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${selected || isMatchingQuestion(q) ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 shadow-lg shadow-amber-500/30' : 'bg-slate-700 text-slate-500'}`}>
              {isMatchingQuestion(q) ? 'Show Answer' : 'Submit'}
            </button>
          ) : (
            <button onClick={nextQ}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-xl text-lg shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all">
              {currentIdx < quizQueue.length - 1 ? 'Next' : 'View Results'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // SUMMARY
  if (view === 'summary') {
    const rate = session.total > 0 ? Math.round(session.correct / session.total * 100) : 0
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 flex flex-col items-center justify-center">
        <div className="p-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl shadow-lg shadow-amber-500/30 mb-6">
          <Shield className="text-slate-900" size={48} />
        </div>
        <h1 className="text-3xl font-bold mb-8">Session Complete!</h1>
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 w-full max-w-sm mb-6 border border-slate-700/50">
          <div className="text-center mb-6">
            <span className={`text-6xl font-bold ${rate >= 70 ? 'text-green-400' : rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{rate}%</span>
            <p className="text-slate-400 mt-2">{rate >= 70 ? 'Excellent!' : rate >= 50 ? 'Keep it up!' : 'Keep practicing!'}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-700/50 rounded-xl p-3">
              <p className="text-2xl font-bold">{session.total}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
            <div className="bg-green-900/30 rounded-xl p-3 border border-green-500/30">
              <p className="text-2xl font-bold text-green-400">{session.correct}</p>
              <p className="text-xs text-green-400/70">Correct</p>
            </div>
            <div className="bg-red-900/30 rounded-xl p-3 border border-red-500/30">
              <p className="text-2xl font-bold text-red-400">{session.total - session.correct}</p>
              <p className="text-xs text-red-400/70">Wrong</p>
            </div>
          </div>
        </div>
        <button onClick={() => setView('home')}
          className="w-full max-w-sm py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-xl shadow-lg shadow-amber-500/30">
          Back to Home
        </button>
        <button onClick={startQuiz}
          className="w-full max-w-sm py-4 mt-3 bg-slate-800/50 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-700/50 transition border border-slate-700/50">
          <RotateCcw size={20} />Try Again
        </button>
      </div>
    )
  }

  // STATS
  if (view === 'stats') {
    let total = 0, correct = 0
    Object.values(history).forEach(arr => arr.forEach(r => { total++; if (r.correct) correct++ }))
    const rate = total > 0 ? Math.round(correct / total * 100) : null
    const hCounts = getHistoryCounts()

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-lg transition"><ChevronLeft size={24} /></button>
            <h1 className="text-xl font-bold">Statistics</h1>
          </div>

          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 mb-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm mb-3 font-medium">Overall Accuracy</p>
            <div className="flex items-end gap-4">
              <span className={`text-5xl font-bold ${rate !== null && rate >= 70 ? 'text-green-400' : rate !== null && rate >= 50 ? 'text-amber-400' : rate !== null ? 'text-red-400' : 'text-slate-500'}`}>
                {rate !== null ? `${rate}%` : '--'}
              </span>
              <span className="text-slate-500 pb-2">{correct} / {total} answers</span>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm mb-4 font-medium">Mastery Progress</p>
            <div className="grid grid-cols-4 gap-3 text-center mb-4">
              {[
                { icon: '🆕', count: hCounts.unanswered, label: 'New', color: 'text-blue-400' },
                { icon: '❌', count: hCounts.wrong, label: 'Wrong', color: 'text-red-400' },
                { icon: '📖', count: hCounts.learning, label: 'Learning', color: 'text-amber-400' },
                { icon: '✅', count: hCounts.mastered, label: 'Mastered', color: 'text-green-400' }
              ].map((item, i) => (
                <div key={i} className="bg-slate-700/50 rounded-xl p-3">
                  <p className="text-2xl">{item.icon}</p>
                  <p className={`text-xl font-bold ${item.color}`}>{item.count}</p>
                  <p className="text-xs text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden flex">
              {hCounts.mastered > 0 && <div className="bg-green-500 h-full transition-all" style={{ width: `${hCounts.mastered / questions.length * 100}%` }} />}
              {hCounts.learning > 0 && <div className="bg-amber-500 h-full transition-all" style={{ width: `${hCounts.learning / questions.length * 100}%` }} />}
              {hCounts.wrong > 0 && <div className="bg-red-500 h-full transition-all" style={{ width: `${hCounts.wrong / questions.length * 100}%` }} />}
              {hCounts.unanswered > 0 && <div className="bg-blue-500/30 h-full transition-all" style={{ width: `${hCounts.unanswered / questions.length * 100}%` }} />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs mb-1">Starred</p>
              <p className="text-yellow-400 text-2xl font-bold flex items-center gap-2">
                <Star size={20} fill="currentColor" />{starred.size}
              </p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs mb-1">Reports</p>
              <p className="text-red-400 text-2xl font-bold flex items-center gap-2">
                <Flag size={20} />{Object.keys(reports).length}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <button onClick={handleExportAllData}
              className="w-full py-3 bg-green-900/30 text-green-400 rounded-xl text-sm hover:bg-green-900/50 transition border border-green-500/30 flex items-center justify-center gap-2">
              <Download size={18} /> Backup All Data
            </button>
            <button onClick={() => { setHistory({}); saveHistory({}) }}
              className="w-full py-3 bg-slate-800/50 rounded-xl text-sm hover:bg-slate-700/50 transition border border-slate-700/50">
              Reset History
            </button>
            <button onClick={() => { setStarred(new Set()); saveStarred(new Set()) }}
              className="w-full py-3 bg-red-900/30 text-red-400 rounded-xl text-sm hover:bg-red-900/50 transition border border-red-500/30">
              Clear All Stars
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
