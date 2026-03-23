// Questions data interface
export interface QuizQuestion {
  id: number
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  category?: string
}

// Export questions 1-288 - these would be extracted from the PDF
// For now, we create a comprehensive question bank structure
export const questionsDatabase: QuizQuestion[] = []

// Helper function to generate questions from PDF text
export function generateQuestionsFromPDF(
  text: string, 
  numQuestions: number = 10
): QuizQuestion[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
  const questions: QuizQuestion[] = []
  const usedIndices = new Set<number>()
  
  for (let i = 0; i < Math.min(numQuestions, sentences.length); i++) {
    let randomIndex: number
    do {
      randomIndex = Math.floor(Math.random() * sentences.length)
    } while (usedIndices.has(randomIndex) && usedIndices.size < sentences.length)
    
    if (usedIndices.size >= sentences.length) break
    usedIndices.add(randomIndex)
    
    const sentence = sentences[randomIndex].trim()
    const words = sentence.split(/\s+/).filter(w => w.length > 3)
    
    if (words.length < 5) continue
    
    // Extract key terms
    const keyTerms = extractKeyTerms(sentence)
    const questionText = generateQuestionFromSentence(sentence)
    const options = generateOptions(keyTerms, sentence, questionText)
    
    if (options.length === 4) {
      questions.push({
        id: i + 1,
        question: questionText,
        options: options,
        correctAnswer: "A",
        explanation: generateExplanation(sentence, options[0]),
        category: "General"
      })
    }
  }
  
  return questions
}

// Extract key terms from text
function extractKeyTerms(text: string): string[] {
  const commonWords = [
    'și', 'cu', 'de', 'la', 'în', 'pe', 'pentru', 'un', 'o', 'ce', 
    'care', 'este', 'sunt', 'am', 'ai', 'a', 'avem', 'aveți', 'au',
    'din', 'prin', 'sau', 'dar', 'nu', 'se', 'sa', 'ei', 'ea', 'el',
    'acest', 'acea', 'acela', 'fel', 'tip', 'mod', 'forma', 'forma'
  ]
  
  const words = text.toLowerCase().split(/\s+/)
  const keyTerms = words
    .filter(word => word.length > 3 && !commonWords.includes(word))
    .filter((word, index, arr) => arr.indexOf(word) === index)
    .slice(0, 6)
  
  return keyTerms
}

// Generate a question from a sentence
function generateQuestionFromSentence(sentence: string): string {
  const templates = [
    `Ce reprezintă "${sentence.split(' ').slice(0, 3).join(' ')}..."?`,
    `Conform textului, care este semnificația următorului concept?`,
    `Care dintre următoarele afirmații este corectă despre conținut?`,
    `Ce informație importantă conține textul despre?`,
    `Care este ideea principală exprimată în acest fragment?`
  ]
  
  return templates[Math.floor(Math.random() * templates.length)]
}

// Generate multiple choice options
function generateOptions(keyTerms: string[], sentence: string, question: string): string[] {
  const term = keyTerms[0] || "concept"
  const term2 = keyTerms[1] || "informație"
  const term3 = keyTerms[2] || "element"
  
  // Generate plausible but incorrect options
  const incorrectOptions = [
    `Un aspect nerelat cu ${term}`,
    `O definiție alternativă pentru ${term2}`,
    `Un exemplu diferit de ${term3}`
  ]
  
  // Create correct answer (somewhat related to the sentence)
  const correctAnswer = `O caracteristică importantă a ${term} menționată în text`
  
  // Shuffle options
  const options = [correctAnswer, ...incorrectOptions]
  const shuffled = options.sort(() => Math.random() - 0.5)
  
  return shuffled
}

// Generate explanation for the answer
function generateExplanation(correctAnswer: string, sentence: string): string {
  const explanations = [
    `Răspunsul corect este A deoarece textul mentionează direct acest concept.`,
    `Conform materialului studiat, varianta A este corectă deoarece reprezintă ideea principală.`,
    `Analizând textul, observăm că răspunsul corect este A, fiind singura variantă conformă cu informațiile.`,
    `Din perspectiva conținutului, varianta A este răspunsul corect bazat pe detaliile din text.`,
    `Explicația pentru răspunsul corect A provine din faptul că textul confirmă această informație.`
  ]
  
  return explanations[Math.floor(Math.random() * explanations.length)]
}

// Get questions by ID range (for questions 1-288)
export function getQuestionsByRange(start: number, end: number): QuizQuestion[] {
  return questionsDatabase.filter(q => q.id >= start && q.id <= end)
}

// Get random questions for quiz
export function getRandomQuestions(count: number, excludeIds: number[] = []): QuizQuestion[] {
  const available = questionsDatabase.filter(q => !excludeIds.includes(q.id))
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Export all as default
export default questionsDatabase