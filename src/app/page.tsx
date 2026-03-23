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

  const onSubmit = async (data: FormData) => {
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
              🤖 Quiz AI
            </h1>
            <p className="text-xl text-white/90">
              Teste inteligente cu feedback personalizat
            </p>
          </div>

          {/* Stats Summary */}
          {statistics && statistics.totalQuestions > 0 && (
            <div className="bg-white/20 backdrop-blur rounded-2xl p-6 mb-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{statistics.totalQuestions}</div>
                  <div className="text-sm text-white/70">Întrebări</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{statistics.accuracy}%</div>
                  <div className="text-sm text-white/70">Acuratețe</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{statistics.streak}</div>
                  <div className="text-sm text-white/70">Streak</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{statistics.correctAnswers}</div>
                  <div className="text-sm text-white/70">Corecte</div>
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Training Mode */}
            <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer group" onClick={onStartTraining}>
              <div className="text-6xl mb-4 text-center">📚</div>
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-4 group-hover:text-indigo-600">
                Mod Antrenament
              </h2>
              <p className="text-gray-600 text-center mb-6">
                Învață cu feedback imediat după fiecare întrebare. Ideal pentru practică și învățare.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">Feedback AI</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">Explicații</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">Fără presiune</span>
              </div>
            </div>

            {/* Test Mode */}
            <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer group" onClick={onStartTest}>
              <div className="text-6xl mb-4 text-center">🎯</div>
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-4 group-hover:text-purple-600">
                Mod Test
              </h2>
              <p className="text-gray-600 text-center mb-6">
                Rezolvă testul și vezi rezultatele la final. Simulare reală de examen.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">Evaluare</span>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">Cronometrat</span>
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">Rezultat final</span>
              </div>
            </div>

            {/* Upload PDF */}
            <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer group" onClick={onUploadPDF}>
              <div className="text-6xl mb-4 text-center">📄</div>
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-4 group-hover:text-blue-600">
                Încărca PDF
              </h2>
              <p className="text-gray-600 text-center mb-6">
                Încarcă un fișier PDF și generează întrebări automat din conținut.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Din PDF</span>
                <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">Auto-generat</span>
              </div>
            </div>

            {/* View Statistics */}
            <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer group" onClick={onViewStats}>
              <div className="text-6xl mb-4 text-center">📊</div>
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-4 group-hover:text-pink-600">
                Statistici
              </h2>
              <p className="text-gray-600 text-center mb-6">
                Vezi istoricul tău de performanță și zonele care necesită îmbunătățire.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">Progres</span>
                <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm">Acuratețe</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 text-white/60 text-sm">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={onBack}
            className="mb-6 text-white hover:text-white/80 flex items-center gap-2"
          >
            ← Înapoi
          </button>

          <div className="bg-white rounded-2xl p-8 shadow-xl">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
              📄 Generează din PDF
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fișier PDF
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setValue('pdfFile', e.target.files?.[0] || null)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500"
                />
                {errors.pdfFile && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.pdfFile.message as string}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instrucțiuni (opțional)
                </label>
                <textarea
                  {...register('customInstructions')}
                  rows={3}
                  placeholder="Ex: Generează întrebări ușoare, Concentrează-te pe definiții"
                  className="w-full p-4 border border-gray-300 rounded-lg resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-lg hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={onExit}
              className="text-white/70 hover:text-white flex items-center gap-2"
            >
              ← Exit
            </button>
            <div className="text-white/70">
              Mod: <span className="font-bold text-yellow-400">{quizMode === 'training' ? 'Antrenament' : 'Test'}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-white/70 mb-2">
              <span>Întrebarea {questionNumber} din {totalQuestions}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-2xl p-8 shadow-2xl mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">
              {question.question}
            </h2>

            <div className="space-y-3">
              {question.options.map((option, idx) => {
                const optionKey = String.fromCharCode(65 + idx)
                const isSelected = selectedAnswer === optionKey
                const isCorrect = optionKey === question.correctAnswer
                
                let bgClass = 'bg-white hover:bg-gray-50'
                let borderClass = 'border-gray-200 hover:border-indigo-300'
                
                if (showFeedback) {
                  if (isCorrect) {
                    bgClass = 'bg-green-100'
                    borderClass = 'border-green-500'
                  } else if (isSelected && !isCorrect) {
                    bgClass = 'bg-red-100'
                    borderClass = 'border-red-500'
                  }
                } else if (isSelected) {
                  bgClass = 'bg-indigo-50'
                  borderClass = 'border-indigo-500'
                }

                return (
                  <button
                    key={idx}
                    onClick={() => !showFeedback && onAnswer(String(idx))}
                    disabled={showFeedback}
                    className={`w-full p-4 text-left rounded-xl border-2 transition-all ${bgClass} ${borderClass} ${!showFeedback ? 'hover:shadow-lg hover:scale-[1.01]' : ''}`}
                  >
                    <span className="font-bold text-gray-700">{option}</span>
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
              <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  {feedback.correct ? (
                    <span className="text-2xl">🎉</span>
                  ) : (
                    <span className="text-2xl">💪</span>
                  )}
                  <span className={`font-bold ${feedback.correct ? 'text-green-600' : 'text-orange-600'}`}>
                    {feedback.explanation}
                  </span>
                </div>
                <p className="text-gray-700 mb-3">{feedback.aiExplanation}</p>
                <div className="bg-yellow-50 p-3 rounded-lg mb-3">
                  <span className="text-yellow-800">💡 {feedback.studyTip}</span>
                </div>
                {feedback.relatedTopics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {feedback.relatedTopics.map((topic, idx) => (
                      <span key={idx} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={onPrev}
              disabled={questionNumber === 1}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            
            {questionNumber === totalQuestions ? (
              <button
                onClick={onFinish}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-blue-600"
              >
                Finalizează Testul
              </button>
            ) : (
              <button
                onClick={onNext}
                className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-lg hover:from-indigo-600 hover:to-purple-600"
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
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
            <div className="text-8xl mb-4">{result.emoji}</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Rezultat Final</h1>
            <p className={`text-2xl font-bold ${result.color} mb-6`}>{result.message}</p>
            
            <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl p-6 mb-8">
              <div className="text-6xl font-bold text-gray-800 mb-2">
                {score} / {total}
              </div>
              <div className="text-gray-600">{percentage}% corect</div>
            </div>

            {/* Answer Review */}
            <div className="mb-8 text-left">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Review Răspunsuri:</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {questions.map((q, idx) => {
                  const userAnswer = answers[idx]
                  const isCorrect = userAnswer === q.correctAnswer
                  return (
                    <div key={idx} className={`p-3 rounded-lg ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                      <span className="font-medium">{idx + 1}.</span> {isCorrect ? '✓' : '✗'}
                      <span className="text-gray-600 ml-2 text-sm">{q.question.substring(0, 50)}...</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={onPlayAgainTraining}
                className="py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-blue-600"
              >
                📚 Antrenament
              </button>
              <button
                onClick={onPlayAgainTest}
                className="py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-600 hover:to-pink-600"
              >
                🎯 Test Nou
              </button>
            </div>
            
            <button
              onClick={onGoHome}
              className="w-full mt-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200"
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
    <div className="min-h-screen bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={onBack}
            className="mb-6 text-white hover:text-white/80 flex items-center gap-2"
          >
            ← Înapoi
          </button>

          <div className="bg-white rounded-2xl p-8 shadow-xl">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
              📊 Statisticile Tale
            </h1>

            {statistics && statistics.totalQuestions > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-xl text-center">
                    <div className="text-3xl font-bold text-blue-600">{statistics.totalQuestions}</div>
                    <div className="text-gray-600">Total Întrebări</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl text-center">
                    <div className="text-3xl font-bold text-green-600">{statistics.accuracy}%</div>
                    <div className="text-gray-600">Acuratețe</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-xl text-center">
                    <div className="text-3xl font-bold text-purple-600">{statistics.correctAnswers}</div>
                    <div className="text-gray-600">Corecte</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl text-center">
                    <div className="text-3xl font-bold text-red-600">{statistics.incorrectAnswers}</div>
                    <div className="text-gray-600">Greșite</div>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl text-center">
                  <div className="text-3xl font-bold text-yellow-600">🔥 {statistics.streak}</div>
                  <div className="text-gray-600">Zile consecutive</div>
                </div>

                {statistics.weakAreas.length > 0 && (
                  <div className="bg-orange-50 p-4 rounded-xl">
                    <h3 className="font-bold text-orange-800 mb-2">Zone care necesită atenție:</h3>
                    <div className="flex flex-wrap gap-2">
                      {statistics.weakAreas.map((area: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-orange-200 text-orange-800 rounded-full">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center text-gray-500">
                  Ultima activitate: {statistics.lastPlayed}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-gray-600">Nu ai încă statistici.</p>
                <p className="text-gray-500 text-sm mt-2">Începe să rezolvi teste pentru a vedea progresul!</p>
              </div>
            )}

            <button
              onClick={onClearProgress}
              className="w-full mt-6 py-3 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200"
            >
              🗑️ Șterge Progresul
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}