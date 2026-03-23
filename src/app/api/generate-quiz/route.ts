// Advanced quiz generation AI service
import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
}

export interface QuizMode {
  id: string
  name: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  questionMultiplier: number
}

export type QuizModeType = 
  | 'definitii' 
  | 'concepte-cheie' 
  | 'intrebari-usor' 
  | 'intrebari-dificil' 
  | 'test-rapid' 
  | 'examen-complet'

// ============================================================================
// QUIZ MODES CONFIGURATION
// ============================================================================

const QuizModesConfig: Record<QuizModeType, QuizMode> = {
  'definitii': {
    id: 'definitii',
    name: 'Definiții',
    description: 'Întrebări despre definiții și terminologie din document',
    difficulty: 'easy',
    questionMultiplier: 1.0
  },
  'concepte-cheie': {
    id: 'concepte-cheie',
    name: 'Concepte cheie',
    description: 'Întrebări despre conceptele fundamentale și ideile principale',
    difficulty: 'medium',
    questionMultiplier: 1.0
  },
  'intrebari-usor': {
    id: 'intrebari-usor',
    name: 'Întrebări ușoare',
    description: 'Întrebări de bază pentru începători',
    difficulty: 'easy',
    questionMultiplier: 1.0
  },
  'intrebari-dificil': {
    id: 'intrebari-dificil',
    name: 'Întrebări dificile',
    description: 'Întrebări avansate pentru utilizatori experimentați',
    difficulty: 'hard',
    questionMultiplier: 1.0
  },
  'test-rapid': {
    id: 'test-rapid',
    name: 'Test rapid',
    description: 'Test scurt pentru verificare rapidă a cunoștințelor',
    difficulty: 'mixed',
    questionMultiplier: 0.5
  },
  'examen-complet': {
    id: 'examen-complet',
    name: 'Examen complet',
    description: 'Test comprehensiv cu toate tipurile de întrebări',
    difficulty: 'mixed',
    questionMultiplier: 2.0
  }
}

// ============================================================================
// AI CONFIGURATION
// ============================================================================

const AI_API_KEY = process.env.OPENROUTER_API_KEY || process.env.HUGGINGFACE_API_KEY || process.env.AI_API_KEY
const USE_LOCAL_AI = process.env.USE_LOCAL_AI === 'true'
const SHOULD_USE_LOCAL_AI = !AI_API_KEY || USE_LOCAL_AI

let AI_API_URL: string
let AI_MODEL: string
let AI_HEADERS: Record<string, string>

if (process.env.OPENROUTER_API_KEY && !USE_LOCAL_AI) {
  AI_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
  AI_MODEL = 'mistralai/mistral-7b-instruct:free'
  AI_HEADERS = {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://localhost:3000',
    'X-Title': 'PDF Quiz Generator'
  }
} else if (process.env.HUGGINGFACE_API_KEY && !USE_LOCAL_AI) {
  AI_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2'
  AI_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2'
  AI_HEADERS = {
    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
    'Content-Type': 'application/json'
  }
} else {
  AI_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
  AI_MODEL = 'mistralai/mistral-7b-instruct:free'
  AI_HEADERS = {
    'Authorization': `Bearer ${AI_API_KEY || ''}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://localhost:3000',
    'X-Title': 'PDF Quiz Generator'
  }
}

// ============================================================================
// BATCH CONFIGURATION
// ============================================================================

const BATCH_SIZE = 20 // Questions per batch to avoid serverless timeouts
const MAX_QUESTIONS = 200
const MAX_TEXT_WORDS = 12000

// ============================================================================
// MAIN API ROUTE
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Check if AI API key is configured
    if (!AI_API_KEY && !SHOULD_USE_LOCAL_AI) {
      return NextResponse.json(
        { error: 'Configurație AI lipsă. Vă rugăm să contactați administratorul.' },
        { status: 500 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const pdfFile = formData.get('pdfFile')
    const modeParam = formData.get('mode') as QuizModeType
    const numQuestionsParam = formData.get('numQuestions')
    const customInstructions = formData.get('customInstructions') as string

    // Validate PDF file
    if (!pdfFile || !(pdfFile instanceof File)) {
      return NextResponse.json(
        { error: 'Nu a fost încărcat niciun fișier PDF' },
        { status: 400 }
      )
    }

    if (pdfFile.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Tip de fișier neacceptat. Se acceptă doar PDF-uri.' },
        { status: 400 }
      )
    }

    // Extract text from PDF
    const arrayBuffer = await pdfFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    let pdfText: string
    try {
      const pdfData = await pdfParse(buffer)
      pdfText = pdfData.text || ''
    } catch (error) {
      console.error('Eroare la parsarea PDF-ului:', error)
      return NextResponse.json(
        { error: 'Eroare la procesarea fișierului PDF. Fișier corupt sau nevalid.' },
        { status: 500 }
      )
    }

    // Validate extracted text
    if (!pdfText || pdfText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nu s-a putut extrage text din PDF. Fișierul poate fi gol sau conține doar imagini.' },
        { status: 400 }
      )
    }

    // Limit text size to avoid serverless timeout
    const words = pdfText.split(/\s+/)
    let processedText = pdfText
    
    if (words.length > MAX_TEXT_WORDS) {
      processedText = words.slice(0, MAX_TEXT_WORDS).join(' ')
      processedText += '\n\n[Textul a fost trunchiat pentru a se încadra în limita de procesare]'
    }

    // Parse mode
    const mode = validateMode(modeParam)
    
    // Parse number of questions
    let numQuestions = parseNumberOfQuestions(numQuestionsParam as string, customInstructions)
    
    // Apply mode multiplier
    numQuestions = Math.min(
      Math.round(numQuestions * QuizModesConfig[mode].questionMultiplier),
      MAX_QUESTIONS
    )
    
    // Ensure minimum questions
    numQuestions = Math.max(numQuestions, 5)

    // Generate quiz using batch processing
    const quiz = await generateQuizBatch(processedText, mode, numQuestions, customInstructions)

    return NextResponse.json({
      success: true,
      quiz: quiz,
      mode: mode,
      modeName: QuizModesConfig[mode].name,
      questionCount: quiz.length,
      fileName: pdfFile.name,
      aiMethod: SHOULD_USE_LOCAL_AI ? 'local' : 'cloud'
    })

  } catch (error) {
    console.error('Eroare la generarea testului:', error)
    return NextResponse.json(
      { error: 'A apărut o eroare la generarea testului. Vă rugăm să încercați din nou.' },
      { status: 500 }
    )
  }
}

// ============================================================================
// BATCH QUIZ GENERATION
// ============================================================================

async function generateQuizBatch(
  pdfText: string,
  mode: QuizModeType,
  totalQuestions: number,
  customInstructions?: string
): Promise<QuizQuestion[]> {
  const allQuestions: QuizQuestion[] = []
  const batches = Math.ceil(totalQuestions / BATCH_SIZE)
  
  for (let batch = 0; batch < batches; batch++) {
    const questionsInBatch = Math.min(BATCH_SIZE, totalQuestions - allQuestions.length)
    const batchStart = batch * BATCH_SIZE + 1
    
    try {
      const batchQuestions = await generateQuizWithAI(
        pdfText,
        mode,
        questionsInBatch,
        batchStart,
        customInstructions
      )
      
      allQuestions.push(...batchQuestions)
      
      // Add small delay between batches to avoid rate limiting
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error(`Eroare la generarea batch-ului ${batch + 1}:`, error)
      // Continue with next batch instead of failing completely
    }
  }

  // If we couldn't generate enough questions, use local fallback
  if (allQuestions.length < 5) {
    const fallbackQuestions = generateLocalFallback(pdfText, Math.max(5, totalQuestions))
    allQuestions.push(...fallbackQuestions)
  }

  // Remove duplicates and validate
  return deduplicateAndValidateQuestions(allQuestions)
}

// ============================================================================
// AI QUIZ GENERATION
// ============================================================================

async function generateQuizWithAI(
  pdfText: string,
  mode: QuizModeType,
  numQuestions: number,
  batchStart: number,
  customInstructions?: string
): Promise<QuizQuestion[]> {
  // Use local AI if no API key available
  if (SHOULD_USE_LOCAL_AI || !AI_API_KEY) {
    return generateQuizLocally(pdfText, mode, numQuestions, batchStart)
  }

  // Build the prompt for the AI
  const prompt = buildPrompt(pdfText, mode, numQuestions, batchStart, customInstructions)

  try {
    let requestBody: any
    
    if (process.env.OPENROUTER_API_KEY && !USE_LOCAL_AI) {
      requestBody = {
        model: AI_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3, // Lower for more deterministic output
        top_p: 0.9,
        top_k: 40,
        repetition_penalty: 1.3,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
        stream: false
      }
    } else {
      requestBody = {
        inputs: prompt,
        parameters: {
          max_new_tokens: 4000,
          temperature: 0.3,
          top_p: 0.9,
          top_k: 40,
          do_sample: true,
          repetition_penalty: 1.3,
          frequency_penalty: 0.5,
          presence_penalty: 0.5,
          return_full_text: false,
          early_stopping: true
        },
      }
    }

    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: AI_HEADERS,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Eroare API AI: ${response.status} - ${errorData.error || 'Server indisponibil'}`)
    }

    const result = await response.json()
    
    // Extract generated text from response
    let generatedText = ''
    
    if (process.env.OPENROUTER_API_KEY && !USE_LOCAL_AI) {
      generatedText = result.choices?.[0]?.message?.content || ''
    } else {
      generatedText = result[0]?.generated_text || result.generated_text || ''
    }
    
    // Parse JSON from the response
    const quiz = parseQuizFromResponse(generatedText, numQuestions)
    
    return quiz

  } catch (error) {
    console.error('Eroare la apelul API AI:', error)
    throw new Error('Eroare la generarea testului cu AI')
  }
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

function buildPrompt(
  pdfText: string,
  mode: QuizModeType,
  numQuestions: number,
  batchStart: number,
  customInstructions?: string
): string {
  const modeConfig = QuizModesConfig[mode]
  
  // Determine difficulty based on mode
  let difficultyInstruction = ''
  switch (mode) {
    case 'intrebari-usor':
      difficultyInstruction = 'DIFICULTATE: UȘOR - Întrebări de bază, concepte fundamentale, definiții simple'
      break
    case 'intrebari-dificil':
      difficultyInstruction = 'DIFICULTATE: DIFICIL - Întrebări complexe, analiză critică, sinteză, aplicare avansată'
      break
    case 'definitii':
      difficultyInstruction = 'DIFICULTATE: UȘOR-MEDIU - Focus pe definiții, terminologie, semnificația termenilor'
      break
    case 'concepte-cheie':
      difficultyInstruction = 'DIFICULTATE: MEDIU - Focus pe concepte fundamentale, idei principale, principii'
      break
    case 'test-rapid':
      difficultyInstruction = 'DIFICULTATE: MIXED - Întrebări scurte și directe pentru verificare rapidă'
      break
    case 'examen-complet':
      difficultyInstruction = 'DIFICULTATE: MIXED - Toate tipurile de întrebări, de la ușor la dificil'
      break
  }

  // Build mode-specific focus
  let focusInstruction = ''
  switch (mode) {
    case 'definitii':
      focusInstruction = 'FOCUS: Întrebări despre definiții, semnificația termenilor, ce înseamnă un concept'
      break
    case 'concepte-cheie':
      focusInstruction = 'FOCUS: Întrebări despre conceptele cheie, ideile principale, principiile fundamentale'
      break
    case 'intrebari-usor':
      focusInstruction = 'FOCUS: Întrebări simple care testează înțelegerea de bază'
      break
    case 'intrebari-dificil':
      focusInstruction = 'FOCUS: Întrebări care necesită analiză profundă, sinteză, evaluare critică'
      break
    case 'test-rapid':
      focusInstruction = 'FOCUS: Întrebări concise care pot fi răspunse rapid'
      break
    case 'examen-complet':
      focusInstruction = 'FOCUS: Varietate de întrebări acoperind tot conținutul documentului'
      break
  }

  return `╔══════════════════════════════════════════════════════════════════════════════╗
║                    GENERATOR ACADEMIC DE ÎNTREBĂRI GRILĂ                          ║
║                              ROMÂNIA - MOD: ${mode.toUpperCase().padEnd(30)}║
╚══════════════════════════════════════════════════════════════════════════════╝

📄 DOCUMENT PDF (SINGURA SURSĂ DE INFORMARE):
${pdfText}

══════════════════════════════════════════════════════════════════════════════
📋 CERINȚE OBLIGATORII:
══════════════════════════════════════════════════════════════════════════════

${difficultyInstruction}
${focusInstruction}

NUMĂR ÎNTREBĂRI: ${numQuestions} (batch ${batchStart}-${batchStart + numQuestions - 1})

${customInstructions ? `📝 INSTRUCȚIUNI SUPLIMENTARE: ${customInstructions}` : ''}

══════════════════════════════════════════════════════════════════════════════
⚠️ REGULI STRICTE - ANTI-HALLUCINATION:
══════════════════════════════════════════════════════════════════════════════

1. Fiecare întrebare TREBUIE să fie bazată STRICT pe conținutul PDF
2. Răspunsul corect TREBUIE să fie o informație EXACTĂ din PDF
3. Răspunsurile greșite TREBUIE să fie distorsiuni logice ale informațiilor din PDF
4. NU folosi cunoștințe generale care nu sunt în PDF
5. NU inventa informații - dacă nu găsești conținut potrivit, sări peste întrebare
6. NU folosi exemple din afara documentului

══════════════════════════════════════════════════════════════════════════════
📊 FORMAT OUTPUT - JSON STRICT:
══════════════════════════════════════════════════════════════════════════════

Returnează UNIC un array JSON cu EXACT ${numQuestions} întrebări.
Fiecare întrebare trebuie să aibă:
- "question": Întrebarea în română
- "options": Array cu EXACT 4 variante (A, B, C, D)
- "correctAnswer": Litera răspunsului corect (A, B, C, sau D)
- "explanation": Explicație detaliată în română care justifică răspunsul corect

Format obligatoriu:
[
  {
    "question": "Întrebarea ta aici?",
    "options": ["A. Varianta A", "B. Varianta B", "C. Varianta C", "D. Varianta D"],
    "correctAnswer": "A",
    "explanation": "Explicație detaliată care justifică de ce răspunsul A este corect, bazată pe PDF."
  }
]

══════════════════════════════════════════════════════════════════════════════
🎯 EXECUȚIE:
══════════════════════════════════════════════════════════════════════════════

Generează acum cele ${numQuestions} întrebări conform cerințelor.
Răspundeți DOAR cu JSON valid, fără text suplimentar.`
}

// ============================================================================
// LOCAL FALLBACK GENERATION
// ============================================================================

function generateQuizLocally(
  pdfText: string,
  mode: QuizModeType,
  numQuestions: number,
  batchStart: number
): QuizQuestion[] {
  const sentences = pdfText.split(/[.!?]+/).filter(s => s.trim().length > 20)
  const quiz: QuizQuestion[] = []
  const usedSentences = new Set<string>()
  
  // Calculate how many sentences to use
  const sentencesToUse = Math.min(sentences.length, numQuestions * 3)
  
  for (let i = 0; i < sentencesToUse && quiz.length < numQuestions; i++) {
    const sentence = sentences[i]?.trim()
    if (!sentence || sentence.length < 30 || usedSentences.has(sentence)) continue
    
    usedSentences.add(sentence)
    
    // Extract key information for question
    const keyInfo = extractKeyInfo(sentence)
    if (!keyInfo) continue
    
    // Generate question based on mode
    const question = generateLocalQuestion(sentence, keyInfo, mode, quiz.length + batchStart)
    if (!question) continue
    
    // Generate options
    const options = generateLocalOptions(keyInfo, sentence, mode)
    
    quiz.push({
      question: question.question,
      options: options.options,
      correctAnswer: options.correctAnswer,
      explanation: question.explanation
    })
  }
  
  return quiz
}

function extractKeyInfo(sentence: string): { terms: string[], subject: string } | null {
  const commonWords = [
    'și', 'cu', 'de', 'la', 'în', 'pe', 'pentru', 'un', 'o', 'ce', 'care', 'este', 'sunt',
    'am', 'ai', 'a', 'avem', 'aveți', 'au', 'se', 'sau', 'dar', 'nici', 'numa', 'cel', 'cea',
    'citi', 'fie', 'asta', 'acest', 'aceast', 'acel', 'acea', 'din', 'dintre', 'prin', 'fără'
  ]
  
  const words = sentence.split(/\s+/).filter(w => w.length > 3 && !commonWords.includes(w.toLowerCase()))
  const terms = [...new Set(words)].slice(0, 5)
  
  if (terms.length < 2) return null
  
  // Extract subject (first meaningful phrase)
  const subjectWords = words.slice(0, Math.min(4, words.length))
  const subject = subjectWords.join(' ')
  
  return { terms, subject }
}

function generateLocalQuestion(
  sentence: string,
  keyInfo: { terms: string[], subject: string },
  mode: QuizModeType,
  index: number
): { question: string, explanation: string } | null {
  const sentenceLower = sentence.toLowerCase()
  
  // Determine question type based on mode and content
  let questionType = 'general'
  
  if (sentenceLower.includes('defini') || sentenceLower.includes('reprezintă') || sentenceLower.includes('înseamnă')) {
    questionType = 'definition'
  } else if (sentenceLower.includes('exemplu') || sentenceLower.includes('cazul') || sentenceLower.includes('aplic')) {
    questionType = 'example'
  } else if (sentenceLower.includes('diferen') || sentenceLower.includes('similar') || sentenceLower.includes('compar')) {
    questionType = 'comparison'
  } else if (sentenceLower.includes('cauz') || sentenceLower.includes('efect') || sentenceLower.includes('rezultat')) {
    questionType = 'cause'
  }
  
  // Override based on mode
  switch (mode) {
    case 'definitii':
      questionType = 'definition'
      break
    case 'concepte-cheie':
      questionType = 'concept'
      break
    case 'intrebari-usor':
      questionType = 'definition'
      break
    case 'intrebari-dificil':
      questionType = 'analysis'
      break
  }
  
  const questionTemplates: Record<string, { template: string, explanation: string }> = {
    definition: {
      template: `Ce reprezintă "${keyInfo.subject.substring(0, 30)}..."?`,
      explanation: `Conform documentului, "${keyInfo.subject.substring(0, 50)}..." este definit în contextul prezentat.`
    },
    concept: {
      template: `Care este conceptul principal descris în textul: "${keyInfo.subject.substring(0, 30)}..."?`,
      explanation: `Documentul prezintă "${keyInfo.subject.substring(0, 50)}..." ca fiind un concept fundamental în acest context.`
    },
    example: {
      template: `Dă un exemplu din document despre: "${keyInfo.subject.substring(0, 30)}..."`,
      explanation: `Textul oferă un exemplu relevant pentru "${keyInfo.subject.substring(0, 50)}...".`
    },
    comparison: {
      template: `Care este diferența dintre "${keyInfo.terms[0]}" și "${keyInfo.terms[1]}" conform documentului?`,
      explanation: `Documentul analizează diferențele dintre acești termeni în contextul studiat.`
    },
    cause: {
      template: `Care este cauza principală pentru "${keyInfo.subject.substring(0, 30)}..." conform textului?`,
      explanation: `Textul identifică cauza și efectul în contextul descris.`
    },
    analysis: {
      template: `Analizează afirmația: "${keyInfo.subject.substring(0, 40)}..."`,
      explanation: `Această afirmație necesită analiză critică bazată pe conținutul documentului.`
    },
    general: {
      template: `Ce informație importantă conține textul despre "${keyInfo.subject.substring(0, 30)}..."?`,
      explanation: `Documentul oferă informații relevante despre acest subiect.`
    }
  }
  
  const selected = questionTemplates[questionType] || questionTemplates.general
  
  return {
    question: selected.template,
    explanation: selected.explanation
  }
}

function generateLocalOptions(
  keyInfo: { terms: string[], subject: string },
  sentence: string,
  mode: QuizModeType
): { options: string[], correctAnswer: string } {
  const options: string[] = []
  const terms = keyInfo.terms
  
  // Correct answer (A)
  const correctAnswer = terms[0] || keyInfo.subject.substring(0, 20)
  options.push(`A. ${correctAnswer}`)
  
  // Wrong answers based on other terms from the text
  const wrongAnswers = [
    `B. ${terms[1] || 'Alt concept din document'}`,
    `C. ${terms[2] || 'O informație diferită'}`,
    `D. ${terms[3] || 'Un termen alternativ'}`
  ]
  
  options.push(...wrongAnswers)
  
  return {
    options: options.slice(0, 4),
    correctAnswer: 'A'
  }
}

function generateLocalFallback(pdfText: string, numQuestions: number): QuizQuestion[] {
  // This should NEVER use general knowledge - only PDF content
  const sentences = pdfText.split(/[.!?]+/).filter(s => s.trim().length > 30)
  
  if (sentences.length === 0) {
    return []
  }
  
  const quiz: QuizQuestion[] = []
  
  for (let i = 0; i < Math.min(numQuestions, sentences.length); i++) {
    const sentence = sentences[i].trim()
    const keyInfo = extractKeyInfo(sentence)
    
    if (!keyInfo) continue
    
    quiz.push({
      question: `Ce informație conține textul: "${keyInfo.subject.substring(0, 40)}..."?`,
      options: [
        `A. ${keyInfo.terms[0] || 'Informație din document'}`,
        `B. ${keyInfo.terms[1] || 'Altă informație'}`,
        `C. ${keyInfo.terms[2] || 'Informație alternativă'}`,
        `D. ${keyInfo.terms[3] || 'Alt concept'}`
      ],
      correctAnswer: 'A',
      explanation: 'Răspunsul corect se bazează pe conținutul documentului PDF.'
    })
  }
  
  return quiz
}

// ============================================================================
// JSON PARSING AND VALIDATION
// ============================================================================

function parseQuizFromResponse(responseText: string, expectedCount: number): QuizQuestion[] {
  try {
    // Try multiple approaches to find JSON
    let jsonString = ''
    
    // Approach 1: Look for JSON array
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonString = jsonMatch[0]
    } else {
      // Approach 2: Look for code blocks
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1]
      } else {
        throw new Error('Nu s-a putut găsi JSON în răspuns')
      }
    }

    // Fix common JSON issues
    const fixedJson = jsonString
      .replace(/'/g, '"')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/(\w+):/g, '"$1":')
      .replace(/"\s+/g, '" ')
      .replace(/\s+"/g, '"')

    let parsed = JSON.parse(fixedJson)
    
    // Ensure we have an array
    if (!Array.isArray(parsed)) {
      if (parsed.question && parsed.options) {
        parsed = [parsed]
      } else {
        throw new Error('Răspunsul nu este un array valid')
      }
    }

    const quiz: QuizQuestion[] = []

    for (const item of parsed) {
      if (!isValidQuestion(item)) continue
      
      // Normalize options
      const normalizedOptions = normalizeOptions(item.options)
      
      // Validate correct answer
      const correctAnswer = normalizeCorrectAnswer(item.correctAnswer)
      
      // Validate explanation
      const explanation = validateExplanation(item.explanation)
      
      quiz.push({
        question: item.question.trim(),
        options: normalizedOptions,
        correctAnswer: correctAnswer,
        explanation: explanation
      })
    }

    return quiz

  } catch (error) {
    console.error('Eroare la parsarea JSON:', error)
    return []
  }
}

function isValidQuestion(item: any): boolean {
  return (
    typeof item.question === 'string' &&
    item.question.trim().length > 0 &&
    Array.isArray(item.options) &&
    item.options.length >= 3 &&
    (typeof item.correctAnswer === 'string' || typeof item.correctAnswer === 'number') &&
    typeof item.explanation === 'string' &&
    item.explanation.trim().length > 0
  )
}

function normalizeOptions(options: string[]): string[] {
  const normalized: string[] = []
  
  for (let i = 0; i < Math.min(4, options.length); i++) {
    const letter = String.fromCharCode(65 + i)
    const cleanOption = options[i].replace(/^[A-D]\.\s*/, '').trim()
    normalized.push(`${letter}. ${cleanOption}`)
  }
  
  // Ensure we have exactly 4 options
  while (normalized.length < 4) {
    const letter = String.fromCharCode(65 + normalized.length)
    normalized.push(`${letter}. Răspuns suplimentar`)
  }
  
  return normalized
}

function normalizeCorrectAnswer(answer: string | number): string {
  let normalized = String(answer).replace(/\./g, '').trim().toUpperCase()
  
  // Handle numeric answers
  if (!isNaN(parseInt(normalized))) {
    const index = parseInt(normalized) - 1
    if (index >= 0 && index < 4) {
      normalized = String.fromCharCode(65 + index)
    }
  }
  
  // Ensure valid letter
  if (!['A', 'B', 'C', 'D'].includes(normalized)) {
    normalized = 'A'
  }
  
  return normalized
}

function validateExplanation(explanation: string): string {
  if (!explanation || explanation.trim().length < 10) {
    return 'Explicația se bazează pe conținutul documentului PDF.'
  }
  return explanation.trim()
}

// ============================================================================
// DEDUPLICATION AND VALIDATION
// ============================================================================

function deduplicateAndValidateQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const seen = new Set<string>()
  const unique: QuizQuestion[] = []
  
  for (const q of questions) {
    // Create a hash of the question
    const questionHash = q.question.toLowerCase().replace(/\s+/g, ' ').substring(0, 50)
    
    if (!seen.has(questionHash)) {
      seen.add(questionHash)
      unique.push(q)
    }
  }
  
  return unique
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function validateMode(mode: string | null): QuizModeType {
  const validModes: QuizModeType[] = [
    'definitii',
    'concepte-cheie',
    'intrebari-usor',
    'intrebari-dificil',
    'test-rapid',
    'examen-complet'
  ]
  
  if (!mode || !validModes.includes(mode as QuizModeType)) {
    return 'examen-complet' // Default mode
  }
  
  return mode as QuizModeType
}

function parseNumberOfQuestions(param: string | null, customInstructions?: string | null): number {
  // First check the direct parameter
  if (param) {
    const num = parseInt(param)
    if (!isNaN(num) && num > 0) {
      return Math.min(num, MAX_QUESTIONS)
    }
  }
  
  // Then check custom instructions
  if (customInstructions) {
    const lower = customInstructions.toLowerCase()
    
    // Look for patterns like "50 intrebari", "100 questions"
    const match = lower.match(/(\d+)\s*(intrebari|questions|inrebari|intrebări)/)
    if (match) {
      const num = parseInt(match[1])
      return Math.min(Math.max(num, 1), MAX_QUESTIONS)
    }
  }
  
  // Default
  return 10
}
