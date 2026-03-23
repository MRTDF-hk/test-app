import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

// AI Configuration - Multiple options supported
const AI_API_KEY = process.env.OPENROUTER_API_KEY || process.env.HUGGINGFACE_API_KEY || process.env.AI_API_KEY

// Determine which AI method to use
const USE_LOCAL_AI = process.env.USE_LOCAL_AI === 'true'
const USE_OPENROUTER = process.env.OPENROUTER_API_KEY && !USE_LOCAL_AI
const USE_HUGGINGFACE = process.env.HUGGINGFACE_API_KEY && !USE_LOCAL_AI && !USE_OPENROUTER

// Default to cloud AI if API key is provided, otherwise use local AI
const SHOULD_USE_LOCAL_AI = !AI_API_KEY || USE_LOCAL_AI

// API configuration for external AI services
let AI_API_URL: string
let AI_MODEL: string
let AI_HEADERS: Record<string, string>

if (USE_OPENROUTER) {
  // OpenRouter API (Recommended - free tier available)
  AI_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
  AI_MODEL = 'mistralai/mistral-7b-instruct:free'
  AI_HEADERS = {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://localhost:3000',
    'X-Title': 'PDF Quiz Generator'
  }
} else if (USE_HUGGINGFACE) {
  // HuggingFace Inference API
  AI_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2'
  AI_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2'
  AI_HEADERS = {
    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
    'Content-Type': 'application/json'
  }
} else {
  // Default to OpenRouter if no specific key is set but AI_API_KEY exists
  AI_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
  AI_MODEL = 'mistralai/mistral-7b-instruct:free'
  AI_HEADERS = {
    'Authorization': `Bearer ${AI_API_KEY || ''}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://localhost:3000',
    'X-Title': 'PDF Quiz Generator'
  }
}

interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: string
}

interface GenerateQuizResponse {
  quiz: QuizQuestion[]
}

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
    const maxWords = 12000 // Slightly smaller than PDF processing to account for prompt
    let processedText = pdfText
    
    if (words.length > maxWords) {
      processedText = words.slice(0, maxWords).join(' ')
      processedText += '\n\n[Textul a fost trunchiat pentru a se încadra în limita de procesare]'
    }

    // Generate quiz using AI (default to local AI if no API key configured)
    const quiz = await generateQuizWithAI(processedText, customInstructions)

    return NextResponse.json({
      success: true,
      quiz: quiz,
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

async function generateQuizWithAI(pdfText: string, customInstructions?: string): Promise<QuizQuestion[]> {
  // If local AI is enabled or no API key available, use rule-based generation
  if (USE_LOCAL_AI || !AI_API_KEY) {
    return generateQuizLocally(pdfText, customInstructions)
  }

  // Build the prompt for the AI with improved instructions
  const instructions = customInstructions 
    ? `Instrucțiuni suplimentare: ${customInstructions}\n\n`
    : ''

  const prompt = `Ești un expert în crearea de teste grilă. Transformă următorul text într-un test grilă în limba română.

${instructions}Text extras din PDF:
"${pdfText}"

Cerințe stricte:
1. Generează MINIM 5 întrebări relevante bazate pe text
2. Fiecare întrebare trebuie să aibă EXACT 4 variante de răspuns (A, B, C, D)
3. Doar un singur răspuns este corect
4. Răspunsurile trebuie să fie plauzibile și bine echilibrate
5. Evită întrebările cu răspunsuri evidente sau triviale
6. Formulează întrebările clar și concis
7. Asigură-te că variantele de răspuns sunt de lungimi similare
8. Returnează DOAR JSON-ul valid, fără explicații suplimentare

Format JSON strict:
[
  {
    "question": "Întrebare clară și relevantă",
    "options": [
      "A. Varianta de răspuns 1",
      "B. Varianta de răspuns 2", 
      "C. Varianta de răspuns 3",
      "D. Varianta de răspuns 4"
    ],
    "correctAnswer": "A"
  }
]

Important: Respecă EXACT formatul JSON de mai sus. Nu adăuga comentarii sau text suplimentar.

Asigură-te că:
- Toate întrebările sunt în limba română
- Răspunsurile sunt diverse și nu evidente
- Întrebările acoperă diferite aspecte ale textului
- Variantele de răspuns sunt de lungimi similare
- JSON-ul este valid și poate fi parsat fără erori`

  try {
    // Prepare request body based on API type
    let requestBody: any
    
    if (USE_OPENROUTER) {
      // OpenRouter format with optimized parameters
      requestBody = {
        model: AI_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000, // Increased for better quality
        temperature: 0.7,  // Slightly higher for creativity
        top_p: 0.9,
        top_k: 40,
        repetition_penalty: 1.05,
        stream: false
      }
    } else {
      // HuggingFace format with optimized parameters
      requestBody = {
        inputs: prompt,
        parameters: {
          max_new_tokens: 3000,
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          do_sample: true,
          repetition_penalty: 1.05,
          return_full_text: false
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
    
    // Extract generated text from response based on API type
    let generatedText = ''
    
    if (USE_OPENROUTER) {
      // OpenRouter format
      generatedText = result.choices?.[0]?.message?.content || ''
    } else {
      // HuggingFace format
      generatedText = result[0]?.generated_text || result.generated_text || ''
    }
    
    // Parse JSON from the response with improved error handling
    const quiz = parseQuizFromResponse(generatedText)
    
    return quiz

  } catch (error) {
    console.error('Eroare la apelul API AI:', error)
    throw new Error('Eroare la generarea testului cu AI. Vă rugăm să încercați din nou.')
  }
}

function generateQuizLocally(pdfText: string, customInstructions?: string): QuizQuestion[] {
  try {
    // Simple text analysis for question generation
    const sentences = pdfText.split(/[.!?]+/).filter(s => s.trim().length > 10)
    const words = pdfText.split(/\s+/).filter(w => w.length > 3)
    
    const quiz: QuizQuestion[] = []
    const usedQuestions = new Set<string>()
    
    // Generate questions based on text analysis
    for (let i = 0; i < Math.min(10, sentences.length); i++) {
      const sentence = sentences[i].trim()
      if (sentence.length < 20 || usedQuestions.has(sentence)) continue
      
      usedQuestions.add(sentence)
      
      // Extract key terms for questions
      const keyTerms = extractKeyTerms(sentence)
      const question = generateQuestionFromSentence(sentence, customInstructions)
      
      if (question && quiz.length < 5) {
        const options = generateOptions(keyTerms, sentence)
        quiz.push({
          question: question,
          options: options,
          correctAnswer: "A"
        })
      }
    }
    
    // If we don't have enough questions, use fallback
    if (quiz.length < 5) {
      const additionalQuestions = generateAdditionalQuestions(5 - quiz.length)
      quiz.push(...additionalQuestions)
    }
    
    return quiz
  } catch (error) {
    console.error('Eroare la generarea locală:', error)
    return generateFallbackQuiz()
  }
}

function extractKeyTerms(sentence: string): string[] {
  // Simple keyword extraction
  const commonWords = ['și', 'cu', 'de', 'la', 'în', 'pe', 'pentru', 'un', 'o', 'ce', 'care', 'este', 'sunt', 'am', 'ai', 'a', 'avem', 'aveți', 'au']
  const words = sentence.toLowerCase().split(/\s+/)
  const keyTerms = words
    .filter(word => word.length > 3 && !commonWords.includes(word))
    .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates
    .slice(0, 4)
  
  return keyTerms
}

function generateQuestionFromSentence(sentence: string, customInstructions?: string): string | null {
  // Simple question generation based on sentence structure
  const sentenceLower = sentence.toLowerCase()
  
  if (sentenceLower.includes('ce este') || sentenceLower.includes('ce reprezintă')) {
    return `Ce reprezintă ${extractSubject(sentence)}?`
  } else if (sentenceLower.includes('cine')) {
    return `Cine este ${extractSubject(sentence)}?`
  } else if (sentenceLower.includes('unde')) {
    return `Unde se află ${extractSubject(sentence)}?`
  } else if (sentenceLower.includes('când')) {
    return `Când a avut loc ${extractSubject(sentence)}?`
  } else {
    return `Care este ${extractSubject(sentence)}?`
  }
}

function extractSubject(sentence: string): string {
  // Simple subject extraction
  const words = sentence.split(/\s+/)
  const subjectWords = words.slice(0, Math.min(4, words.length))
  return subjectWords.join(' ')
}

function generateOptions(keyTerms: string[], sentence: string): string[] {
  const options = []
  
  // Correct answer (first option)
  options.push(`A. ${keyTerms[0] || sentence.substring(0, 20)}...`)
  
  // Distractors (wrong answers)
  const distractors = [
    `B. ${keyTerms[1] || 'Un concept necunoscut'}`,
    `C. ${keyTerms[2] || 'O idee generală'}`,
    `D. ${keyTerms[3] || 'Un termen tehnic'}`
  ]
  
  options.push(...distractors)
  
  // Ensure we have exactly 4 options
  while (options.length < 4) {
    options.push(`${String.fromCharCode(65 + options.length)}. Răspuns suplimentar`)
  }
  
  return options.slice(0, 4)
}

function parseQuizFromResponse(responseText: string): QuizQuestion[] {
  try {
    // Try multiple approaches to find JSON in the response
    let jsonString = ''
    
    // Approach 1: Look for JSON array pattern
    const jsonMatch = responseText.match(/\[([\s\S]*?)\]/)
    if (jsonMatch) {
      jsonString = jsonMatch[0]
    } else {
      // Approach 2: Look for JSON object pattern
      const objectMatch = responseText.match(/\{[\s\S]*\}/)
      if (objectMatch) {
        jsonString = objectMatch[0]
      } else {
        // Approach 3: Try to extract from code blocks
        const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
        if (codeBlockMatch) {
          jsonString = codeBlockMatch[1]
        } else {
          throw new Error('Nu s-a putut găsi JSON în răspunsul AI')
        }
      }
    }

    let parsed
    try {
      parsed = JSON.parse(jsonString)
    } catch (parseError) {
      // Try to fix common JSON issues
      const fixedJson = jsonString
        .replace(/'/g, '"')  // Replace single quotes with double quotes
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']')  // Remove trailing commas
        .replace(/(\w+):/g, '"$1":')  // Add quotes to keys
      
      parsed = JSON.parse(fixedJson)
    }

    // Ensure we have an array
    if (!Array.isArray(parsed)) {
      if (parsed.question && parsed.options && parsed.correctAnswer) {
        parsed = [parsed] // Convert single object to array
      } else {
        throw new Error('Răspunsul AI nu este un array valid sau un obiect întrebare valid')
      }
    }

    const quiz: QuizQuestion[] = []

    for (const item of parsed) {
      if (
        typeof item.question === 'string' &&
        Array.isArray(item.options) &&
        item.options.length >= 3 && // Allow minimum 3 options
        typeof item.correctAnswer === 'string'
      ) {
        // Normalize options format (ensure they start with A., B., C., D.)
        const normalizedOptions = item.options.map((opt: string, index: number) => {
          const letter = String.fromCharCode(65 + index)
          const cleanOption = opt.replace(/^[A-D]\.\s*/, '').trim()
          return `${letter}. ${cleanOption}`
        })

        // Ensure we have exactly 4 options
        while (normalizedOptions.length < 4) {
          normalizedOptions.push(`${String.fromCharCode(65 + normalizedOptions.length)}. Răspuns suplimentar`)
        }

        // Validate correct answer format
        let correctAnswer = item.correctAnswer.replace(/\./g, '').trim().toUpperCase()
        
        // If correct answer is a number, convert to letter
        if (!isNaN(parseInt(correctAnswer))) {
          const index = parseInt(correctAnswer) - 1
          if (index >= 0 && index < 4) {
            correctAnswer = String.fromCharCode(65 + index)
          }
        }

        // Ensure correct answer is valid
        if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
          correctAnswer = 'A' // Default to first option if invalid
        }
        
        quiz.push({
          question: item.question.trim(),
          options: normalizedOptions.slice(0, 4), // Take only first 4 options
          correctAnswer: correctAnswer,
        })
      }
    }

    // Ensure we have at least 5 questions
    if (quiz.length < 5) {
      // Generate additional questions to reach minimum
      const additionalQuestions = generateAdditionalQuestions(5 - quiz.length)
      quiz.push(...additionalQuestions)
    }

    return quiz

  } catch (error) {
    console.error('Eroare la parsarea răspunsului AI:', error)
    
    // Fallback: generate a simple quiz structure
    return generateFallbackQuiz()
  }
}

function generateAdditionalQuestions(count: number): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  
  for (let i = 0; i < count; i++) {
    questions.push({
      question: `Întrebare suplimentară ${i + 1}`,
      options: [
        "A. Răspuns A",
        "B. Răspuns B", 
        "C. Răspuns C",
        "D. Răspuns D"
      ],
      correctAnswer: "A"
    })
  }
  
  return questions
}

function generateFallbackQuiz(): QuizQuestion[] {
  return [
    {
      question: "Care este capitala României?",
      options: ["A. Cluj-Napoca", "B. Timișoara", "C. București", "D. Iași"],
      correctAnswer: "C"
    },
    {
      question: "Câte continente există pe Pământ?",
      options: ["A. 5", "B. 6", "C. 7", "D. 8"],
      correctAnswer: "C"
    },
    {
      question: "Cine a scris 'Mai am un singur dor'?",
      options: ["A. Mihai Eminescu", "B. Lucian Blaga", "C. Nichita Stănescu", "D. Tudor Arghezi"],
      correctAnswer: "A"
    },
    {
      question: "Care este cel mai mare ocean?",
      options: ["A. Atlantic", "B. Indian", "C. Arctic", "D. Pacific"],
      correctAnswer: "D"
    },
    {
      question: "În ce an a căzut zidul Berlinului?",
      options: ["A. 1987", "B. 1989", "C. 1991", "D. 1993"],
      correctAnswer: "B"
    }
  ]
}