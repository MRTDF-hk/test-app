'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { analyzeAnswer, classifyText } from '../lib/ai-service'
import { 
  updateProgress, 
  getProgress, 
  getStatistics, 
  clearProgress,
  cacheQuestions,
  getCachedQuestions
} from '../lib/storage'

type FormData = {
  pdfFile: File | null
  customInstructions: string
}

const formSchema = z.object({
  pdfFile: z
    .instanceof(File)
    .refine((file) => file?.type === 'application/pdf', {
      message: 'Selectați un fișier PDF valid',
    })
    .optional(),
  customInstructions: z.string().optional(),
  numQuestions: z.coerce.number().min(1).max(100).default(10),
})

interface Question {
  id: number
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  category?: string
}

interface QuizFeedback {
  correct: boolean
  userAnswer: string
  correctAnswer: string
  explanation: string
  aiExplanation: string
  studyTip: string
  relatedTopics: string[]
}

type AppMode = 'home' | 'upload' | 'quiz' | 'results' | 'statistics'
type QuizMode = 'training' | 'test'

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>('home')
  const [quizMode, setQuizMode] = useState<QuizMode>('training')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [feedback, setFeedback] = useState<Record<number, QuizFeedback>>({})
  const [showFeedback, setShowFeedback] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [statistics, setStatistics] = useState<any>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  // Load statistics on mount
  useEffect(() => {
    setStatistics(getStatistics())
  }, [appMode])

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsProcessing(true)
    setError(null)
    
    // Check for cached questions first
    const cached = getCachedQuestions()
    if (cached && cached.length > 0) {
      setQuestions(cached)
      setAppMode('quiz')
      setIsProcessing(false)
      return
    }

    // If no PDF provided, generate sample questions
    if (!data.pdfFile) {
      const sampleQuestions = generateSampleQuestions(10)
      setQuestions(sampleQuestions)
      cacheQuestions(sampleQuestions)
      setAppMode('quiz')
      setIsProcessing(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('pdfFile', data.pdfFile)
      if (data.customInstructions) {
        formData.append('customInstructions', data.customInstructions)
      }
      formData.append('numQuestions', String(data.numQuestions || 10))

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Eroare la generarea testului')
      }

      const result = await response.json()
      const quizQuestions = result.quiz || []
      
      setQuestions(quizQuestions)
      cacheQuestions(quizQuestions)
      setFileName(data.pdfFile.name)
      setAppMode('quiz')
    } catch (err) {
      // Fallback to sample questions on error
      const sampleQuestions = generateSampleQuestions(10)
      setQuestions(sampleQuestions)
      cacheQuestions(sampleQuestions)
      setAppMode('quiz')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAnswer = (answer: string) => {
    const currentQuestion = questions[currentIndex]
    if (!currentQuestion) return

    const answerKey = String.fromCharCode(65 + parseInt(answer))
    const newAnswers = { ...answers, [currentIndex]: answerKey }
    setAnswers(newAnswers)

    // Generate AI feedback
    const fb = analyzeAnswer(
      currentQuestion.question,
      answerKey,
      currentQuestion.correctAnswer,
      currentQuestion.options
    )
    
    const newFeedback = { ...feedback, [currentIndex]: fb }
    setFeedback(newFeedback)
    setShowFeedback(true)

    // Update progress
    const topic = classifyText(currentQuestion.question).label
    updateProgress(currentQuestion.id, fb.correct, topic)
  }

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowFeedback(false)
    } else {
      setAppMode('results')
    }
  }

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowFeedback(!!feedback[currentIndex - 1])
    }
  }

  const restartQuiz = (mode: QuizMode) => {
    setQuizMode(mode)
    setCurrentIndex(0)
    setAnswers({})
    setFeedback({})
    setShowFeedback(false)
    setAppMode('quiz')
  }

  const calculateScore = () => {
    let correct = 0
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) {
        correct++
      }
    })
    return correct
  }

  // Generate sample questions for demo
  function generateSampleQuestions(count: number): Question[] {
    const templates = [
      {
        question: "Ce reprezintă conceptul de machine learning?",
        options: [
          "A. O metodă de programare tradițională",
          "B. Un subset al AI care permite sistemelor să învețe din date",
          "C. Un tip de hardware pentru calcul",
          "D. Un protocol de rețea"
        ],
        correctAnswer: "B",
        explanation: "Machine learning este un subset al inteligenței artificiale care permite sistemelor să învețe și să se îmbunătățască din experiență."
      },
      {
        question: "Care este diferența dintre învățarea supervizată și nesupervizată?",
        options: [
          "A. Nu există nicio diferență",
          "B. Supervizată folosește date etichetate, nesupervizată nu",
          "C. Supervizată este mai lentă",
          "D. Nesupervizată necesită mai multe date"
        ],
        correctAnswer: "B",
        explanation: "Învățarea supervizată folosește date de antrenament etichetate, în timp ce nesupervizată găsește patternuri în date neetichetate."
      },
      {
        question: "Ce este o rețea neuronală?",
        options: [
          "A. Un tip de bază de date",
          "B. Un model de calcul inspirat de creierul uman",
          "C. Un protocol de comunicație",
          "D. Un sistem de operare"
        ],
        correctAnswer: "B",
        explanation: "Rețelele neuronale sunt modele computaționale inspirate de structura și funcționarea neuronilor biologici."
      },
      {
        question: "Ce înseamnă overfitting în machine learning?",
        options: [
          "A. Când modelul funcționează prea bine",
          "B. Când modelul memorizează datele de antrenament în loc să generalizeze",
          "C. Când modelul este prea simplu",
          "D. Când avem prea puține date"
        ],
        correctAnswer: "B",
        explanation: "Overfitting apare când modelul învață too bine datele de antrenament, dar nu generalizează bine pe date noi."
      },
      {
        question: "Care este scopul normalizării datelor?",
        options: [
          "A. Creșterea volumului de date",
          "B. Scalarea caracteristicilor la aceeași scară",
          "C. Eliminarea tuturor datelor",
          "D. Criptarea datelor"
        ],
        correctAnswer: "B",
        explanation: "Normalizarea scală caracteristicile la o scară comună, ceea ce ajută algoritmii să converga mai rapid."
      },
      {
        question: "Ce este gradient descent?",
        options: [
          "A. Un tip de rețea",
          "B. Un algoritm de optimizare pentru găsirea minimului unei funcții",
          "C. Un format de imagine",
          "D. Un protocol HTTP"
        ],
        correctAnswer: "B",
        explanation: "Gradient descent este un algoritm de optimizare iterativă care găsește minimul unei funcții prin mișcări în direcția opusă gradientului."
      },
      {
        question: "Ce suntepoch-urile în antrenarea unei rețele neuronale?",
        options: [
          "A. Numărul de straturi",
          "B. O trecere completă prin întregul set de date de antrenament",
          "C. Tipul de activare",
          "D. Dimensunea batch-ului"
        ],
        correctAnswer: "B",
        explanation: "Un epoch reprezintă o iterație completă prin întregul set de date de antrenament în procesul de învățare."
      },
      {
        question: "Ce este transfer learning?",
        options: [
          "A. Mutarea datelor între servere",
          "B. Utilizarea cunoștințelor dintr-un domeniu pentru un alt domeniu",
          "C. Un tip de rețea",
          "D. Un algoritm de sortare"
        ],
        correctAnswer: "B",
        explanation: "Transfer learning permite folosirea unui model antrenat pe o sarcină ca punct de plecare pentru o altă sarcină related."
      },
      {
        question: "Ce evaluează metrica accuracy?",
        options: [
          "A. Timpul de execuție",
          "B. Procentul de predicții corecte",
          "C. Dimensiunea modelului",
          "D. Consumul de memorie"
        ],
        correctAnswer: "B",
        explanation: "Accuracy măsoară procentul de predicții corecte din totalul predicțiilor făcute de model."
      },
      {
        question: "Ce este batch size?",
        options: [
          "A. Numărul total de date",
          "B. Numărul de mostre procesate într-o singură iteratie",
          "C. Numărul de straturi",
          "D. Rata de învățare"
        ],
        correctAnswer: "B",
        explanation: "Batch size reprezintă numărul de mostre de date procesate simultan înainte de actualizarea ponderilor modelului."
      }
    ]

    return templates.slice(0, count).map((q, idx) => ({
      ...q,
      id: idx + 1
    }))
  }

  // Render home screen
  if (appMode === 'home') {
    return (
      <HomeScreen 
        onStartTraining={() => {
          setQuizMode('training')
          setQuestions(generateSampleQuestions(10))
          setAppMode('quiz')
        }}
        onStartTest={() => {
          setQuizMode('test')
          setQuestions(generateSampleQuestions(10))
          setAppMode('quiz')
        }}
        onUploadPDF={() => setAppMode('upload')}
        onViewStats={() => setAppMode('statistics')}
        statistics={statistics}
      />
    )
  }

  // Render upload screen
  if (appMode === 'upload') {
    return (
      <UploadScreen
        onBack={() => setAppMode('home')}
        onSubmit={onSubmit}
        isProcessing={isProcessing}
        error={error}
        register={register}
        handleSubmit={handleSubmit}
        setValue={setValue}
        errors={errors}
      />
    )
  }

  // Render quiz screen
  if (appMode === 'quiz' && questions.length > 0) {
    const currentQuestion = questions[currentIndex]
    const currentFeedback = feedback[currentIndex]
    const progress = ((currentIndex + 1) / questions.length) * 100

    return (
      <QuizScreen
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        progress={progress}
        selectedAnswer={answers[currentIndex]}
        feedback={currentFeedback}
        showFeedback={showFeedback}
        quizMode={quizMode}
        onAnswer={handleAnswer}
        onNext={nextQuestion}
        onPrev={prevQuestion}
        onFinish={() => setAppMode('results')}
        onExit={() => setAppMode('home')}
      />
    )
  }

  // Render results screen
  if (appMode === 'results') {
    return (
      <ResultsScreen
        score={calculateScore()}
        total={questions.length}
        onPlayAgainTraining={() => restartQuiz('training')}
        onPlayAgainTest={() => restartQuiz('test')}
        onGoHome={() => {
          reset()
          setQuestions([])
          setAppMode('home')
        }}
        answers={answers}
        questions={questions}
      />
    )
  }

  // Render statistics screen
  if (appMode === 'statistics') {
    return (
      <StatisticsScreen
        statistics={statistics}
        onBack={() => setAppMode('home')}
        onClearProgress={() => {
          clearProgress()
          setStatistics(getStatistics())
        }}
      />
    )
  }

  return null
}

// Home Screen Component
function HomeScreen({ 
  onStartTraining, 
  onStartTest, 
  onUploadPDF,
  onViewStats,
  statistics 
}: {
  onStartTraining: () => void
  onStartTest: () => void
  onUploadPDF: () => void
  onViewStats: () => void
  statistics: any
}) {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 pt-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl mb-6 shadow-lg shadow-violet-500/30">
              <span className="text-4xl">🧠</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
              Quiz AI
            </h1>
            <p className="text-lg text-slate-400">
              Teste inteligente cu feedback personalizat
            </p>
          </div>

          {/* Stats Summary */}
          {statistics && statistics.totalQuestions > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <div className="text-2xl font-bold text-white">{statistics.totalQuestions}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Întrebări</div>
                </div>
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <div className="text-2xl font-bold text-emerald-400">{statistics.accuracy}%</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Acuratețe</div>
                </div>
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <div className="text-2xl font-bold text-amber-400">{statistics.streak}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Streak</div>
                </div>
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <div className="text-2xl font-bold text-blue-400">{statistics.correctAnswers}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Corecte</div>
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Training Mode */}
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-7 hover:border-violet-500/50 hover:bg-slate-800 transition-all duration-300 hover:-translate-y-1 cursor-pointer group" onClick={onStartTraining}>
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-4 mx-auto shadow-lg shadow-emerald-500/20">
                <span className="text-2xl">📚</span>
              </div>
              <h2 className="text-xl font-semibold text-white text-center mb-3 group-hover:text-emerald-400 transition-colors">
                Mod Antrenament
              </h2>
              <p className="text-slate-400 text-center text-sm mb-5">
                Învață cu feedback imediat după fiecare întrebare. Ideal pentru practică și învățare.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-md text-xs font-medium">Feedback AI</span>
                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-md text-xs font-medium">Explicații</span>
                <span className="px-2.5 py-1 bg-violet-500/20 text-violet-400 rounded-md text-xs font-medium">Fără presiune</span>
              </div>
            </div>

            {/* Test Mode */}
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-7 hover:border-amber-500/50 hover:bg-slate-800 transition-all duration-300 hover:-translate-y-1 cursor-pointer group" onClick={onStartTest}>
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 mx-auto shadow-lg shadow-amber-500/20">
                <span className="text-2xl">🎯</span>
              </div>
              <h2 className="text-xl font-semibold text-white text-center mb-3 group-hover:text-amber-400 transition-colors">
                Mod Test
              </h2>
              <p className="text-slate-400 text-center text-sm mb-5">
                Rezolvă testul și vezi rezultatele la final. Simulare reală de examen.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-md text-xs font-medium">Evaluare</span>
                <span className="px-2.5 py-1 bg-red-500/20 text-red-400 rounded-md text-xs font-medium">Cronometrat</span>
                <span className="px-2.5 py-1 bg-orange-500/20 text-orange-400 rounded-md text-xs font-medium">Rezultat final</span>
              </div>
            </div>

            {/* Upload PDF */}
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-7 hover:border-cyan-500/50 hover:bg-slate-800 transition-all duration-300 hover:-translate-y-1 cursor-pointer group" onClick={onUploadPDF}>
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 mx-auto shadow-lg shadow-cyan-500/20">
                <span className="text-2xl">📄</span>
              </div>
              <h2 className="text-xl font-semibold text-white text-center mb-3 group-hover:text-cyan-400 transition-colors">
                Încărca PDF
              </h2>
              <p className="text-slate-400 text-center text-sm mb-5">
                Încarcă un fișier PDF și generează întrebări automat din conținut.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-2.5 py-1 bg-slate-700 text-slate-300 rounded-md text-xs font-medium">Din PDF</span>
                <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-400 rounded-md text-xs font-medium">Auto-generat</span>
              </div>
            </div>

            {/* View Statistics */}
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-7 hover:border-pink-500/50 hover:bg-slate-800 transition-all duration-300 hover:-translate-y-1 cursor-pointer group" onClick={onViewStats}>
              <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center mb-4 mx-auto shadow-lg shadow-pink-500/20">
                <span className="text-2xl">📊</span>
              </div>
              <h2 className="text-xl font-semibold text-white text-center mb-3 group-hover:text-pink-400 transition-colors">
                Statistici
              </h2>
              <p className="text-slate-400 text-center text-sm mb-5">
                Vezi istoricul tău de performanță și zonele care necesită îmbunătățire.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-400 rounded-md text-xs font-medium">Progres</span>
                <span className="px-2.5 py-1 bg-pink-500/20 text-pink-400 rounded-md text-xs font-medium">Acuratețe</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 text-slate-500 text-sm">
            <p>🚀 Rulează local • Fără API-uri externe • Vercel Ready</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Upload Screen Component
function UploadScreen({
  onBack,
  onSubmit,
  isProcessing,
  error,
  register,
  handleSubmit,
  setValue,
  errors
}: any) {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={onBack}
            className="mb-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            ← Înapoi
          </button>

          <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold text-white mb-6 text-center">
              📄 Generează din PDF
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Fișier PDF
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setValue('pdfFile', e.target.files?.[0] || null)}
                  className="w-full p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-violet-500 bg-slate-700/50 text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-500 file:text-white hover:file:bg-violet-600"
                />
                {errors.pdfFile && (
                  <p className="mt-1 text-sm text-red-400">
                    {errors.pdfFile.message as string}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Număr de întrebări
                </label>
                <input
                  type="number"
                  {...register('numQuestions')}
                  min={1}
                  max={100}
                  defaultValue={10}
                  className="w-full p-4 border border-slate-600 rounded-lg bg-slate-700/50 text-slate-200 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Introduceți un număr între 1 și 100
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Instrucțiuni (opțional)
                </label>
                <textarea
                  {...register('customInstructions')}
                  rows={4}
                  placeholder="Exemple:
• '100 intrebari' - generează 100 de întrebări
• 'intrebari 1-288' - folosește doar întrebările 1-288 din PDF
• '50 intrebari din 1-100' - 50 întrebări din primele 100
• 'Generează întrebări ușoare' - nivel ușor
• 'intrebari dificile' - nivel avansat
• 'regenereaza' - recreează quiz-ul cu noile instrucțiuni"
                  className="w-full p-4 border border-slate-600 rounded-lg resize-none bg-slate-700/50 text-slate-200 placeholder-slate-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-lg hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Se procesează...
                  </span>
                ) : (
                  'Generează Testul'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// Quiz Screen Component
function QuizScreen({
  question,
  questionNumber,
  totalQuestions,
  progress,
  selectedAnswer,
  feedback,
  showFeedback,
  quizMode,
  onAnswer,
  onNext,
  onPrev,
  onFinish,
  onExit
}: {
  question: Question
  questionNumber: number
  totalQuestions: number
  progress: number
  selectedAnswer?: string
  feedback?: QuizFeedback
  showFeedback: boolean
  quizMode: 'training' | 'test'
  onAnswer: (answer: string) => void
  onNext: () => void
  onPrev: () => void
  onFinish: () => void
  onExit: () => void
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={onExit}
              className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
            >
              ← Exit
            </button>
            <div className="text-slate-400">
              Mod: <span className="font-bold text-amber-400">{quizMode === 'training' ? 'Antrenament' : 'Test'}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-slate-400 mb-2 text-sm">
              <span>Întrebarea {questionNumber} din {totalQuestions}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-7 shadow-2xl mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 bg-violet-500/20 text-violet-400 rounded-md text-xs font-medium">
                Întrebarea {questionNumber}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-white mb-6 leading-relaxed">
              {question.question}
            </h2>

            <div className="space-y-3">
              {question.options.map((option, idx) => {
                const optionKey = String.fromCharCode(65 + idx)
                const isSelected = selectedAnswer === optionKey
                const isCorrect = optionKey === question.correctAnswer
                
                let bgClass = 'bg-slate-700/50 hover:bg-slate-700'
                let borderClass = 'border-slate-600 hover:border-violet-500'
                
                if (showFeedback) {
                  if (isCorrect) {
                    bgClass = 'bg-emerald-500/20 border-emerald-500'
                    borderClass = 'border-emerald-500'
                  } else if (isSelected && !isCorrect) {
                    bgClass = 'bg-red-500/20 border-red-500'
                    borderClass = 'border-red-500'
                  }
                } else if (isSelected) {
                  bgClass = 'bg-violet-500/20 border-violet-500'
                  borderClass = 'border-violet-500'
                }

                return (
                  <button
                    key={idx}
                    onClick={() => !showFeedback && onAnswer(String(idx))}
                    disabled={showFeedback}
                    className={`w-full p-4 text-left rounded-xl border-2 transition-all ${bgClass} ${borderClass} ${!showFeedback ? 'hover:shadow-lg hover:scale-[1.01]' : ''}`}
                  >
                    <span className="font-medium text-slate-200">{option}</span>
                    {showFeedback && isCorrect && (
                      <span className="ml-2 text-green-600">✓</span>
                    )}
                    {showFeedback && isSelected && !isCorrect && (
                      <span className="ml-2 text-red-600">✗</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Feedback Section (Training Mode) */}
            {showFeedback && feedback && quizMode === 'training' && (
              <div className="mt-6 p-5 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-xl border border-violet-500/30">
                <div className="flex items-center gap-2 mb-3">
                  {feedback.correct ? (
                    <span className="text-2xl">🎉</span>
                  ) : (
                    <span className="text-2xl">💪</span>
                  )}
                  <span className={`font-semibold ${feedback.correct ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {feedback.explanation}
                  </span>
                </div>
                <p className="text-slate-300 mb-3 text-sm leading-relaxed">{feedback.aiExplanation}</p>
                <div className="bg-amber-500/10 p-3 rounded-lg mb-3 border border-amber-500/20">
                  <span className="text-amber-400">💡 {feedback.studyTip}</span>
                </div>
                {feedback.relatedTopics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {feedback.relatedTopics.map((topic, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-violet-500/20 text-violet-400 rounded-md text-xs font-medium">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between gap-4">
            <button
              onClick={onPrev}
              disabled={questionNumber === 1}
              className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              ← Anterior
            </button>
            
            {questionNumber === totalQuestions ? (
              <button
                onClick={onFinish}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all shadow-lg shadow-emerald-500/25"
              >
                Finalizează Testul
              </button>
            ) : (
              <button
                onClick={onNext}
                className="px-8 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-lg hover:from-violet-600 hover:to-fuchsia-600 transition-all shadow-lg shadow-violet-500/25"
              >
                Următoarea →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Results Screen Component
function ResultsScreen({
  score,
  total,
  onPlayAgainTraining,
  onPlayAgainTest,
  onGoHome,
  answers,
  questions
}: {
  score: number
  total: number
  onPlayAgainTraining: () => void
  onPlayAgainTest: () => void
  onGoHome: () => void
  answers: Record<number, string>
  questions: Question[]
}) {
  const percentage = Math.round((score / total) * 100)
  
  const getResultMessage = () => {
    if (percentage >= 90) return { emoji: '🏆', message: 'Excelent! Ești un maestru!', color: 'text-yellow-500' }
    if (percentage >= 70) return { emoji: '🌟', message: 'Foarte bine! Continua așa!', color: 'text-green-500' }
    if (percentage >= 50) return { emoji: '💪', message: 'Bine! Mai puțin și e perfect!', color: 'text-blue-500' }
    return { emoji: '📚', message: 'Keep learning! Vei reuși!', color: 'text-purple-500' }
  }

  const result = getResultMessage()

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-amber-500/30">
              <span className="text-5xl">{result.emoji}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Rezultat Final</h1>
            <p className={`text-xl font-semibold ${result.color} mb-6`}>{result.message}</p>
            
            <div className="bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 rounded-2xl p-6 mb-8">
              <div className="text-5xl font-bold text-white mb-2">
                {score} / {total}
              </div>
              <div className="text-slate-400">{percentage}% corect</div>
            </div>

            {/* Answer Review */}
            <div className="mb-8 text-left">
              <h3 className="text-base font-semibold text-white mb-4">Review Răspunsuri:</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {questions.map((q, idx) => {
                  const userAnswer = answers[idx]
                  const isCorrect = userAnswer === q.correctAnswer
                  return (
                    <div key={idx} className={`p-3 rounded-lg ${isCorrect ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                      <span className="font-medium text-white">{idx + 1}.</span> {isCorrect ? '✓' : '✗'}
                      <span className="text-slate-400 ml-2 text-sm">{q.question.substring(0, 50)}...</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={onPlayAgainTraining}
                className="py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/25"
              >
                📚 Antrenament
              </button>
              <button
                onClick={onPlayAgainTest}
                className="py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-lg hover:from-violet-600 hover:to-fuchsia-600 transition-all shadow-lg shadow-violet-500/25"
              >
                🎯 Test Nou
              </button>
            </div>
            
            <button
              onClick={onGoHome}
              className="w-full mt-4 py-3 bg-slate-700 text-slate-300 font-semibold rounded-lg hover:bg-slate-600 hover:text-white transition-all"
            >
              🏠 Înapoi la Meniu
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Statistics Screen Component
function StatisticsScreen({
  statistics,
  onBack,
  onClearProgress
}: {
  statistics: any
  onBack: () => void
  onClearProgress: () => void
}) {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={onBack}
            className="mb-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            ← Înapoi
          </button>

          <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold text-white mb-6 text-center">
              📊 Statisticile Tale
            </h1>

            {statistics && statistics.totalQuestions > 0 ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-center">
                    <div className="text-3xl font-bold text-blue-400">{statistics.totalQuestions}</div>
                    <div className="text-slate-400 text-sm">Total Întrebări</div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center">
                    <div className="text-3xl font-bold text-emerald-400">{statistics.accuracy}%</div>
                    <div className="text-slate-400 text-sm">Acuratețe</div>
                  </div>
                  <div className="bg-violet-500/10 border border-violet-500/20 p-4 rounded-xl text-center">
                    <div className="text-3xl font-bold text-violet-400">{statistics.correctAnswers}</div>
                    <div className="text-slate-400 text-sm">Corecte</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-center">
                    <div className="text-3xl font-bold text-red-400">{statistics.incorrectAnswers}</div>
                    <div className="text-slate-400 text-sm">Greșite</div>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center">
                  <div className="text-3xl font-bold text-amber-400">🔥 {statistics.streak}</div>
                  <div className="text-slate-400 text-sm">Zile consecutive</div>
                </div>

                {statistics.weakAreas.length > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl">
                    <h3 className="font-semibold text-orange-400 mb-2">Zone care necesită atenție:</h3>
                    <div className="flex flex-wrap gap-2">
                      {statistics.weakAreas.map((area: string, idx: number) => (
                        <span key={idx} className="px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center text-slate-500 text-sm">
                  Ultima activitate: {statistics.lastPlayed}
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-20 h-20 bg-slate-700 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <span className="text-4xl">📝</span>
                </div>
                <p className="text-slate-400 mb-2">Nu ai încă statistici.</p>
                <p className="text-slate-500 text-sm">Începe să rezolvi teste pentru a vedea progresul!</p>
              </div>
            )}

            <button
              onClick={onClearProgress}
              className="w-full mt-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-medium rounded-lg hover:bg-red-500/20 transition-all"
            >
              🗑️ Șterge Progresul
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}