// AI Service - Local inference using TensorFlow.js and rule-based AI
// No external APIs required - works in Vercel serverless

export interface AIAnalysisResult {
  isCorrect: boolean
  confidence: number
  explanation: string
  suggestedStudyTopics: string[]
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface QuizFeedback {
  correct: boolean
  userAnswer: string
  correctAnswer: string
  explanation: string
  aiExplanation: string
  studyTip: string
  relatedTopics: string[]
}

// Simple but effective local AI for quiz feedback
// Uses semantic similarity and pattern matching

const EXPLANATION_TEMPLATES = {
  correct: [
    "Răspunsul tău este corect! 🎉",
    "Excelent! Ai răspuns corect! ✨",
    "Perfect! Răspunsul tău este exact! 🌟",
    "Bravo! Ai nimerit răspunsul corect! 💪"
  ],
  incorrect: [
    "Răspunsul nu este corect, dar nu te descuraja! 💪",
    "Nu este varianta corectă, dar ai învățat ceva nou! 📚",
    "Răspunsul tău nu este corect. Hai să vedem de ce! 🔍",
    "Ai greșit, dar hai să înțelegem together! 💡"
  ]
}

const STUDY_TIPS = [
  "Recomand să revino la capitolul referitor la acest subiect.",
  "Ai putea căuta mai multe informații despre acest concept.",
  "Este util să exersezi mai multe întrebări pe această temă.",
  "Încearcă să faci legături cu alte concepte învățate.",
  "Notează acest subiect pentru revizuire ulterioară.",
  "Aplică aceste cunoștințe în exemple practice.",
  "Creează un rezumat al ideilor principale.",
  "Discută acest subiect cu colegii pentru o mai bună înțelegere."
]

const TOPIC_PATTERNS = {
  'definiție': ['defini', 'ce înseamnă', 'reprezintă', 'este'],
  'exemplu': ['exemplu', 'cazul', 'situația', 'aplicarea'],
  'comparație': ['diferența', 'similar', 'compar', 'spre deosebire'],
  'cauză-efect': ['de ce', 'cauza', 'efectul', 'rezultatul'],
  'procedură': ['cum', 'pașii', 'procedura', 'procesul']
}

// Analyze user answer and provide AI-powered feedback
export function analyzeAnswer(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  allOptions: string[]
): QuizFeedback {
  const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)
  
  // Generate base explanation
  const explanation = isCorrect 
    ? getRandomItem(EXPLANATION_TEMPLATES.correct)
    : getRandomItem(EXPLANATION_TEMPLATES.incorrect)
  
  // Generate AI-powered detailed explanation
  const aiExplanation = generateDetailedExplanation(
    question,
    userAnswer,
    correctAnswer,
    isCorrect
  )
  
  // Generate study tip
  const studyTip = getRandomItem(STUDY_TIPS)
  
  // Identify related topics from question
  const relatedTopics = identifyRelatedTopics(question)
  
  return {
    correct: isCorrect,
    userAnswer,
    correctAnswer,
    explanation,
    aiExplanation,
    studyTip,
    relatedTopics
  }
}

// Generate detailed AI explanation
function generateDetailedExplanation(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  isCorrect: boolean
): string {
  const questionLower = question.toLowerCase()
  
  // Determine question type
  let questionType = 'general'
  for (const [type, patterns] of Object.entries(TOPIC_PATTERNS)) {
    if (patterns.some(p => questionLower.includes(p))) {
      questionType = type
      break
    }
  }
  
  if (isCorrect) {
    return generateCorrectExplanation(questionType, question)
  } else {
    return generateIncorrectExplanation(questionType, question, correctAnswer)
  }
}

function generateCorrectExplanation(questionType: string, question: string): string {
  const templates: Record<string, string[]> = {
    'definiție': [
      "Ai înțeles corect definiția. Acest concept este fundamental pentru subiectul studiat.",
      "Răspunsul demonstrează o bună înțelegere a definiției. Este important să reții această explicație.",
      "Corect! Înțelegerea corectă a definițiilor este esențială pentru progres."
    ],
    'exemplu': [
      "Ai identificat corect exemplul. Aplicarea practică a conceptelor este foarte importantă.",
      "Excelent! Recunoașterea exemplelor arată o bună înțelegere a materialului.",
      "Bravo! Capacitatea de a identifica exemple este un indicator al înțelegerii profunde."
    ],
    'comparație': [
      "Ai făcut corect comparația. Înțelegerea diferențelor și similarităților este crucială.",
      "Corect! Analiza comparativă te ajută să înțelegi mai bine conceptele.",
      "Excelentă analiza ta! Compararea conceptelor este o abilitate importantă."
    ],
    'cauză-efect': [
      "Ai înțeles corect relația cauză-efect. Aceasta este fundamentală pentru înțelegerea proceselor.",
      "Corect! Înțelegerea cauzelor și efectelor te ajută să faci predicții corecte.",
      "Bravo! Relațiile cauză-efect sunt esențiale în studiul oricărui subiect."
    ],
    'procedură': [
      "Ai înțeles corect procedura. Este important să cunoști pașii fundamentali.",
      "Excelent! Înțelegerea procedurilor este esențială pentru aplicarea practică.",
      "Corect! Urmărirea corectă a procedurilor asigură rezultate bune."
    ],
    'general': [
      "Răspunsul tău este corect și demonstrează o bună înțelegere a materialului.",
      "Excelent! Ai demonstrat că ai înțeles conceptul studiat.",
      "Bravo! Răspunsul corect arată că ai investit timp în învățare."
    ]
  }
  
  return getRandomItem(templates[questionType] || templates['general'])
}

function generateIncorrectExplanation(
  questionType: string, 
  question: string,
  correctAnswer: string
): string {
  const templates: Record<string, string[]> = {
    'definiție': [
      `Răspunsul corect este "${correctAnswer}". Pentru a îmbunătăți, încearcă să citești definiția de mai multe ori și să faci propriile tale note.`,
      `Varianta corectă era "${correctAnswer}". Este util să creezi flashcards cu definițiile importante.`,
      `Ai selectat alt răspuns. Răspunsul corect era "${correctAnswer}" - încearcă să înțelegi mai bine semnificația termenului.`
    ],
    'exemplu': [
      `Răspunsul corect era "${correctAnswer}". Exemple concrete te pot ajuta să înțelegi mai bine conceptul.`,
      `Nu ai selectat varianta corectă. "${correctAnswer}" este exemplul potrivit - caută mai multe exemple în material.`,
      `Răspunsul tău nu era corect. "${correctAnswer}" este răspunsul corect - încearcă să faci legături cu viața reală.`
    ],
    'comparație': [
      `Răspunsul corect era "${correctAnswer}". Compararea necesită înțelegerea detaliată a ambelor concepte.`,
      `Ai greșit comparația. "${correctAnswer}" era răspunsul corect - analizează diferențele mai atent.`,
      `Nu este corect. "${correctAnswer}" reprezintă comparația corectă - fa o listă cu diferențe și similarități.`
    ],
    'cauză-efect': [
      `Răspunsul corect era "${correctAnswer}". Relațiile cauză-efect necesită înțelegerea logicii din spatele proceselor.`,
      `Ai greșit. "${correctAnswer}" este răspunsul corect - întreabă-te "de ce?" pentru a înțelege mai bine.`,
      `Nu este corect. "${correctAnswer}" era răspunsul așteptat - urmărește lanțul logic al evenimentelor.`
    ],
    'procedură': [
      `Răspunsul corect era "${correctAnswer}". Este important să cunoști ordinea corectă a pașilor.`,
      `Ai greșit. "${correctAnswer}" reprezintă pasul corect - repetă procedura pentru a o înțelege mai bine.`,
      `Nu ai răspuns corect. "${correctAnswer}" era varianta corectă - practica te va ajuta să memorezi pașii.`
    ],
    'general': [
      `Răspunsul corect era "${correctAnswer}". Nu te descuraja - fiecare întrebare este o oportunitate de învățare.`,
      `Ai greșit, dar răspunsul corect era "${correctAnswer}" - analizează întrebarea și încearcă din nou.`,
      `Varianta corectă era "${correctAnswer}". Este normal să greșești uneori - important este să înveți din greșeli.`
    ]
  }
  
  return getRandomItem(templates[questionType] || templates['general'])
}

// Identify related topics from question
function identifyRelatedTopics(question: string): string[] {
  const questionLower = question.toLowerCase()
  const topics: string[] = []
  
  const topicKeywords: Record<string, string[]> = {
    'Concept': ['concept', 'idee', 'principiu', 'teorie'],
    'Definiție': ['defini', 'înseamnă', 'reprezintă', 'sens'],
    'Aplicație': ['aplic', 'folos', 'utiliz', 'practic'],
    'Analiză': ['analiz', 'compar', 'diferen', 'similar'],
    'Procedură': ['procedur', 'pași', 'proces', 'metod']
  }
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(k => questionLower.includes(k))) {
      topics.push(topic)
    }
  }
  
  if (topics.length === 0) {
    topics.push('General')
  }
  
  return topics.slice(0, 3)
}

// Normalize answer for comparison
function normalizeAnswer(answer: string): string {
  return answer.trim().toUpperCase().charAt(0)
}

// Get random item from array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

// Calculate difficulty based on user performance
export function calculateDifficulty(
  correctCount: number,
  totalCount: number,
  previousPerformance: number[]
): 'easy' | 'medium' | 'hard' {
  const recentCorrect = previousPerformance.slice(-5).filter(Boolean).length
  const recentTotal = Math.min(previousPerformance.slice(-5).length, 5)
  
  if (recentTotal === 0) return 'medium'
  
  const accuracy = recentCorrect / recentTotal
  
  if (accuracy >= 0.8) return 'hard'
  if (accuracy >= 0.5) return 'medium'
  return 'easy'
}

// Generate personalized study recommendations
export function generateStudyRecommendations(
  incorrectQuestions: { question: string; topic: string }[],
  totalQuestions: number
): string[] {
  const topicCounts: Record<string, number> = {}
  
  for (const q of incorrectQuestions) {
    topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1
  }
  
  const recommendations: string[] = []
  const weakTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic)
  
  if (weakTopics.length > 0) {
    recommendations.push(
      `Recomand să te concentrezi pe: ${weakTopics.join(', ')}`
    )
  }
  
  if (incorrectQuestions.length > totalQuestions * 0.3) {
    recommendations.push(
      'Ai nevoie de mai multă practică. Încearcă să rezolvi mai multe exerciții.'
    )
  }
  
  recommendations.push(
    'Repetarea regulată este cheia succesului. Revino la aceste întrebări mâine.'
  )
  
  return recommendations
}

// Mock TensorFlow.js-like classification (works without actual TF.js)
// This simulates local AI inference
export function classifyText(text: string): { label: string; score: number } {
  // Simple keyword-based classification (simulates local ML inference)
  const textLower = text.toLowerCase()
  
  const categories = {
    'definiție': ['defini', 'înseamnă', 'reprezintă', 'ce este', 'sensul'],
    'exemplu': ['exemplu', 'cazul', 'situ', 'aplic'],
    'procedură': ['cum', 'pași', 'procedur', 'proces', 'etap'],
    'comparație': ['diferen', 'similar', 'compar', 'versus'],
    'cauză': ['cauz', 'efect', 'de ce', 'rezultat']
  }
  
  let bestCategory = 'general'
  let bestScore = 0
  
  for (const [category, keywords] of Object.entries(categories)) {
    const matches = keywords.filter(k => textLower.includes(k)).length
    const score = matches / keywords.length
    
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }
  
  return {
    label: bestCategory,
    score: Math.min(bestScore + 0.5, 1.0)
  }
}