// Storage Service - Local storage for user progress
// Works in browser and can be adapted for serverlessx

export interface UserProgress {
  id: string
  totalQuestions: number
  correctAnswers: number
  incorrectAnswers: number
  recentResults: {
    questionId: number
    isCorrect: boolean
    timestamp: number
  }[]
  weakAreas: string[]
  lastPlayed: number
  streak: number
}

export interface QuizSession {
  mode: 'training' | 'test'
  questions: number[]
  currentIndex: number
  answers: Record<number, string>
  startTime: number
  completedAt?: number
}

// Storage keys
const PROGRESS_KEY = 'quiz_user_progress'
const SESSION_KEY = 'quiz_current_session'
const QUESTIONS_KEY = 'quiz_questions_cache'

// Generate unique user ID
function getUserId(): string {
  if (typeof window === 'undefined') {
    return 'server-' + Date.now()
  }
  
  let userId = localStorage.getItem('quiz_user_id')
  if (!userId) {
    userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('quiz_user_id', userId)
  }
  return userId
}

// Get current progress
export function getProgress(): UserProgress {
  if (typeof window === 'undefined') {
    return getDefaultProgress()
  }
  
  try {
    const stored = localStorage.getItem(PROGRESS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Error reading progress:', e)
  }
  
  return getDefaultProgress()
}

// Get default progress
function getDefaultProgress(): UserProgress {
  return {
    id: getUserId(),
    totalQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    recentResults: [],
    weakAreas: [],
    lastPlayed: 0,
    streak: 0
  }
}

// Save progress
export function saveProgress(progress: UserProgress): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch (e) {
    console.error('Error saving progress:', e)
  }
}

// Update progress with a new result
export function updateProgress(
  questionId: number,
  isCorrect: boolean,
  topic?: string
): UserProgress {
  const progress = getProgress()
  
  progress.totalQuestions++
  
  if (isCorrect) {
    progress.correctAnswers++
  } else {
    progress.incorrectAnswers++
    
    if (topic) {
      progress.weakAreas = [...new Set([...progress.weakAreas, topic])].slice(-10)
    }
  }
  
  // Update recent results
  progress.recentResults.push({
    questionId,
    isCorrect,
    timestamp: Date.now()
  })
  
  // Keep only last 50 results
  if (progress.recentResults.length > 50) {
    progress.recentResults = progress.recentResults.slice(-50)
  }
  
  // Update streak
  const now = Date.now()
  const dayInMs = 24 * 60 * 60 * 1000
  
  if (progress.lastPlayed > 0 && now - progress.lastPlayed < dayInMs * 2) {
    progress.streak++
  } else if (now - progress.lastPlayed > dayInMs * 2) {
    progress.streak = 1
  }
  
  progress.lastPlayed = now
  
  saveProgress(progress)
  
  return progress
}

// Get accuracy percentage
export function getAccuracy(): number {
  const progress = getProgress()
  if (progress.totalQuestions === 0) return 0
  return Math.round((progress.correctAnswers / progress.totalQuestions) * 100)
}

// Get recent performance
export function getRecentPerformance(count: number = 10): boolean[] {
  const progress = getProgress()
  return progress.recentResults
    .slice(-count)
    .map(r => r.isCorrect)
}

// Get weak areas
export function getWeakAreas(): string[] {
  return getProgress().weakAreas
}

// Clear all progress
export function clearProgress(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PROGRESS_KEY)
  localStorage.removeItem(SESSION_KEY)
}

// Save quiz session
export function saveQuizSession(session: QuizSession): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch (e) {
    console.error('Error saving session:', e)
  }
}

// Get quiz session
export function getQuizSession(): QuizSession | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Error reading session:', e)
  }
  
  return null
}

// Clear quiz session
export function clearQuizSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}

// Cache questions for offline use
export function cacheQuestions(questions: any[]): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions))
  } catch (e) {
    console.error('Error caching questions:', e)
  }
}

// Get cached questions
export function getCachedQuestions(): any[] | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(QUESTIONS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Error reading cached questions:', e)
  }
  
  return null
}

// Get statistics for display
export function getStatistics() {
  const progress = getProgress()
  
  return {
    totalQuestions: progress.totalQuestions,
    correctAnswers: progress.correctAnswers,
    incorrectAnswers: progress.incorrectAnswers,
    accuracy: getAccuracy(),
    streak: progress.streak,
    weakAreas: progress.weakAreas,
    lastPlayed: progress.lastPlayed > 0 
      ? new Date(progress.lastPlayed).toLocaleDateString('ro-RO')
      : 'Niciodată'
  }
}