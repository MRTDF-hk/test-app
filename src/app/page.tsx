'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

type FormData = {
  pdfFile: File | null
  customInstructions: string
}

const formSchema = z.object({
  pdfFile: z
    .instanceof(File)
    .refine((file) => file.type === 'application/pdf', {
      message: 'Selectați un fișier PDF valid',
    }),
  customInstructions: z.string().optional(),
})

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [quiz, setQuiz] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: FormData) => {
    setIsProcessing(true)
    setError(null)
    setQuiz([])
    
    // Validate that we have a file
    if (!data.pdfFile) {
      setError('Vă rugăm să selectați un fișier PDF')
      setIsProcessing(false)
      return
    }
    
    const formData = new FormData()
    formData.append('pdfFile', data.pdfFile)
    if (data.customInstructions && data.customInstructions.trim()) {
      formData.append('customInstructions', data.customInstructions.trim())
    }

    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'A apărut o eroare la generarea testului')
      }

      const result = await response.json()
      setQuiz(result.quiz)
      setFileName(data.pdfFile.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare necunoscută')
    } finally {
      setIsProcessing(false)
    }
  }

  const resetQuiz = () => {
    setQuiz([])
    setError(null)
    setFileName(null)
    reset()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Generator de Teste PDF
          </h1>
          <p className="text-lg text-gray-600">
            Încărcați un PDF și generați un test grilă în limba română
          </p>
        </div>

        {/* Main Card */}
        <div className="card p-8 animate-fade-in">
          {!quiz.length ? (
            /* Upload Form */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fișier PDF
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      setValue('pdfFile', file || null)
                    }}
                    className="input-field cursor-pointer"
                  />
                  {errors.pdfFile && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.pdfFile.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instrucțiuni personalizate (opțional)
                </label>
                <textarea
                  {...register('customInstructions')}
                  rows={3}
                  placeholder="Ex: Generează întrebări ușoare, Concentrează-te pe definiții"
                  className="input-field resize-none"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Adăugați instrucțiuni suplimentare pentru AI (opțional)
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Se procesează...
                    </span>
                  ) : (
                    'Generează Testul'
                  )}
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
            </form>
          ) : (
            /* Quiz Display */
            <QuizComponent
              quiz={quiz}
              fileName={fileName}
              onReset={resetQuiz}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* Quiz Component */
function QuizComponent({
  quiz,
  fileName,
  onReset,
}: {
  quiz: any[]
  fileName: string | null
  onReset: () => void
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({})
  const [score, setScore] = useState<number | null>(null)

  const handleAnswer = (questionIndex: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: answer }))
    setShowAnswers((prev) => ({ ...prev, [questionIndex]: false }))
    setScore(null)
  }

  const checkAnswers = () => {
    let correctCount = 0
    quiz.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctCount++
      }
    })
    setScore(correctCount)
  }

  const resetQuestion = (questionIndex: number) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev }
      delete newAnswers[questionIndex]
      return newAnswers
    })
    setShowAnswers((prev) => ({ ...prev, [questionIndex]: false }))
    setScore(null)
  }

  const showCorrectAnswer = (questionIndex: number) => {
    setShowAnswers((prev) => ({ ...prev, [questionIndex]: true }))
  }

  const allAnswered = quiz.length > 0 && Object.keys(answers).length === quiz.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Test generat din: {fileName}
          </h2>
          <p className="text-gray-600">
            Răspundeți la întrebări și verificați răspunsurile
          </p>
        </div>
        <button
          onClick={onReset}
          className="btn-secondary"
        >
          Începe din nou
        </button>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {quiz.map((question, questionIndex) => (
          <div key={questionIndex} className="card p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {questionIndex + 1}. {question.question}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {question.options.map((option: string, optionIndex: number) => {
                const isCorrect = option === question.correctAnswer
                const isSelected = answers[questionIndex] === option
                const shouldShowCorrect = showAnswers[questionIndex] && isCorrect
                const shouldShowIncorrect = showAnswers[questionIndex] && isSelected && !isCorrect

                let bgColor = 'bg-white'
                if (shouldShowCorrect) bgColor = 'bg-green-100 border-green-300'
                if (shouldShowIncorrect) bgColor = 'bg-red-100 border-red-300'
                if (isSelected && !showAnswers[questionIndex]) bgColor = 'bg-blue-50 border-blue-300'

                return (
                  <button
                    key={optionIndex}
                    onClick={() => handleAnswer(questionIndex, option)}
                    disabled={showAnswers[questionIndex]}
                    className={`p-3 text-left rounded-lg border-2 transition-all duration-200 hover:shadow-md ${bgColor}`}
                  >
                    <span className="font-medium">{String.fromCharCode(65 + optionIndex)}.</span>{' '}
                    {option}
                  </button>
                )
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => showCorrectAnswer(questionIndex)}
                className="btn-secondary text-sm"
                disabled={showAnswers[questionIndex]}
              >
                Vezi răspunsul corect
              </button>
              <button
                onClick={() => resetQuestion(questionIndex)}
                className="btn-secondary text-sm"
              >
                Mai încearcă o dată
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Score and Actions */}
      {allAnswered && (
        <div className="card p-6">
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={checkAnswers}
                className="btn-primary"
              >
                Verifică răspunsurile
              </button>
              {score !== null && (
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  Scor: {score}/{quiz.length}
                </p>
              )}
            </div>
            <button
              onClick={onReset}
              className="btn-secondary"
            >
              Începe din nou
            </button>
          </div>
        </div>
      )}
    </div>
  )
}