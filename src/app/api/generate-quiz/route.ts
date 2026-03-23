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
    const numQuestionsParam = formData.get('numQuestions')
    const numQuestionsFromForm = numQuestionsParam ? parseInt(numQuestionsParam as string) : null

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
    // Parse custom instructions for number of questions and question range
    const parsedInstructions = parseCustomInstructions(customInstructions)
    // Override numQuestions from form if provided
    if (numQuestionsFromForm && numQuestionsFromForm > 0) {
      parsedInstructions.numQuestions = Math.min(Math.max(numQuestionsFromForm, 1), 100)
    }
    const quiz = await generateQuizWithAI(processedText, customInstructions, parsedInstructions)

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

async function generateQuizWithAI(pdfText: string, customInstructions?: string, parsedInstructions?: ParsedInstructions): Promise<QuizQuestion[]> {
  // Use parsedInstructions if provided, otherwise parse from customInstructions
  const parsed = parsedInstructions || parseCustomInstructions(customInstructions)
  
  // If local AI is enabled or no API key available, use rule-based generation
  if (USE_LOCAL_AI || !AI_API_KEY) {
    return generateQuizLocally(pdfText, customInstructions, parsed.numQuestions)
  }

  // Build the prompt for the AI - SIMPLE AND DIRECT
  const extraInstructions = customInstructions 
    ? `CERERE UTILIZATOR: ${customInstructions}
`
    : ''

  // Analyze user instructions
  const userInstructions = customInstructions ? customInstructions.toLowerCase() : ''
  const isDifficult = userInstructions.includes('dific') || userInstructions.includes('hard') || userInstructions.includes('complex')
  const isEasy = userInstructions.includes('ușor') || userInstructions.includes('easy') || userInstructions.includes('basic')
  const focusDefinitions = userInstructions.includes('defini') || userInstructions.includes('terminolog')
  const focusExamples = userInstructions.includes('exempl') || userInstructions.includes('aplica')
  const regenerate = userInstructions.includes('regen') || userInstructions.includes('recalcul') || userInstructions.includes('refă')
  
  const difficultyText = isDifficult ? 'ÎNTREBĂRI DIFICILE - analiză profundă, sinteză' : 
                         isEasy ? 'ÎNTREBĂRI UȘOARE - concepte de bază' : 
                         'ÎNTREBĂRI MEDII'
  
  const focusText = focusDefinitions ? 'FOCUS: definiții și termeni' : 
                    focusExamples ? 'FOCUS: exemple și aplicații' : 
                    'FOCUS: echilibrat'

  const prompt = `CREARE TEST GRILĂ - ROMÂNĂ

📄 DOCUMENT PDF (SINGURA SURSA):
${pdfText}

📋 CERINȚE:
- ${parsed.numQuestions} întrebări
- ${difficultyText}
- ${focusText}
- Interval: ${parsed.questionRange || 'tot PDF-ul'}
${regenerate ? '- REGENEREAZĂ quiz-ul complet' : ''}

🎯 REGULI OBLIGATORII:
1. Fiecare întrebare și răspuns TREBUIE să fie în PDF
2. NU folosi informații din afara PDF-ului
3. Răspunsul corect = informație din PDF
4. Răspunsurile greșite = distorsiuni ale informațiilor din PDF
5. Exact 4 variante (A,B,C,D) per întrebare

⚠️ FII ATENT LA CEREREA UTILIZATORULUI:
${customInstructions || 'Generează test standard'}

📊 FORMAT JSON cu EXACT ${parsed.numQuestions} întrebări:
[{"question":"...","options":["A.","B.","C.","D."],"correctAnswer":"A"}]
- JSON-ul este valid și poate fi parsat fără erori

Dacă utilizatorul specifică:
- "Generează întrebări ușoare" → Creează întrebări de bază, concepte fundamentale din PDF
- "Generează întrebări dificile" → Creează întrebări complexe, analiză profundă a textului
- "Concentrează-te pe definiții" → Prioritizează întrebări de definire și terminologie din PDF
- "Concentrează-te pe exemple" → Creează întrebări bazate pe aplicații practice din PDF
- "Focusează-te pe [subiect specific]" → Prioritizează acel subiect în generare
- "intrebari 1-288" sau "questions 1-288" → Concentrează-te pe acel interval din PDF

IMPORTANT: Respectă EXACT instrucțiunile utilizatorului. Dacă specifică un anumit tip de întrebări sau un anumit subiect, concentrează-te exclusiv pe acel aspect. Nu ignora cerințele utilizatorului.

NU folosi cunoștințe generale care nu sunt în PDF. Toate întrebările trebuie să fie bazate STRICT pe textul furnizat.`

  // Enhanced prompt with better instruction following - CRITICAL INSTRUCTIONS
  const enhancedPrompt = `${prompt}

═══════════════════════════════════════════════════════════════════════════════
⚠️ ATENȚIE MAXIMĂ - REGULI ANTI-INTERNET:
═══════════════════════════════════════════════════════════════════════════════
❌ NU ACCESA INTERNETUL - EȘTI OFFLINE
❌ NU CĂUTA PE GOOGLE - TOTUL TREBUIE SĂ VIE DIN PDF
❌ RĂSPUNSUL CORECT TREBUIE SĂ FIE ÎN PDF
❌ RĂSPUNSURILE GREȘITE TREBUIE SĂ FIE TOT DIN PDF (distorsionate)

🎯 EXECUȚIE INSTRUCȚIUNI UTILIZATOR:
Dacă spui "regenerează" sau "refă" - ignoră quiz-ul anterior și creează unul nou conform noilor cerințe
Dacă specifici un număr diferit de întrebări - respectă exact numărul
Dacă specifici un interval - concentrează-te pe acel segment din PDF
Dacă modifici dificultatea - schimbă nivelul conform cerințelor

ACUM EXECUTĂ: Generează exact ${parsed.numQuestions} întrebări conform instrucțiunilor: ${customInstructions || 'test standard'}`

  try {
    // Prepare request body based on API type with enhanced parameters
    let requestBody: any
    
    if (USE_OPENROUTER) {
      // OpenRouter format with enhanced parameters for better quality
      requestBody = {
        model: AI_MODEL,
        messages: [
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        max_tokens: 5000, // Increased for more detailed responses
        temperature: 0.5,  // Lower for better instruction following
        top_p: 0.9,
        top_k: 40,
        repetition_penalty: 1.2,
        frequency_penalty: 0.3, // Reduce repetition
        presence_penalty: 0.3,  // Encourage new topics
        stream: false
      }
    } else {
      // HuggingFace format with enhanced parameters
      requestBody = {
        inputs: enhancedPrompt,
        parameters: {
          max_new_tokens: 5000,
          temperature: 0.5,
          top_p: 0.9,
          top_k: 40,
          do_sample: true,
          repetition_penalty: 1.2,
          frequency_penalty: 0.3,
          presence_penalty: 0.3,
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

function generateQuizLocally(pdfText: string, customInstructions?: string, numQuestions: number = 10): QuizQuestion[] {
  try {
    // Simple text analysis for question generation
    const sentences = pdfText.split(/[.!?]+/).filter(s => s.trim().length > 10)
    const words = pdfText.split(/\s+/).filter(w => w.length > 3)
    
    const quiz: QuizQuestion[] = []
    const usedQuestions = new Set<string>()
    
    // Calculate how many questions to generate based on numQuestions (up to 100)
    const targetQuestions = Math.min(numQuestions, 100)
    const sentencesToUse = Math.min(sentences.length, targetQuestions * 3) // Need more sentences for variety
    
    // Generate questions based on text analysis
    for (let i = 0; i < sentencesToUse; i++) {
      const sentence = sentences[i].trim()
      if (sentence.length < 20 || usedQuestions.has(sentence)) continue
      
      usedQuestions.add(sentence)
      
      // Extract key terms for questions
      const keyTerms = extractKeyTerms(sentence)
      const question = generateQuestionFromSentence(sentence, customInstructions)
      
      if (question && quiz.length < targetQuestions) {
        const options = generateOptions(keyTerms, sentence)
        quiz.push({
          question: question,
          options: options,
          correctAnswer: "A"
        })
      }
      
      if (quiz.length >= targetQuestions) break
    }
    
    // If we don't have enough questions, use fallback
    if (quiz.length < 5) {
      const additionalQuestions = generateAdditionalQuestions(Math.max(5, targetQuestions) - quiz.length)
      quiz.push(...additionalQuestions)
    }
    
    return quiz.slice(0, targetQuestions)
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

    // Ensure we have at least 5 questions but also respect the requested number
    // Default to at least 5 if we don't have enough, but try to get as many as possible
    const minQuestions = 5
    if (quiz.length < minQuestions) {
      // Generate additional questions to reach minimum
      const additionalQuestions = generateAdditionalQuestions(minQuestions - quiz.length)
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

// Parse custom instructions to extract number of questions and question range
interface ParsedInstructions {
  numQuestions: number
  questionRange: string | null
}

function parseCustomInstructions(instructions?: string): ParsedInstructions {
  const result: ParsedInstructions = {
    numQuestions: 10, // Default number of questions
    questionRange: null
  }
  
  if (!instructions) return result
  
  const lowerInstructions = instructions.toLowerCase()
  
  // Extract number of questions - look for patterns like "50 intrebari", "100 questions", etc.
  const numberMatch = lowerInstructions.match(/(\d+)\s*(intrebari|questions|inrebari|intrebări)/)
  if (numberMatch) {
    const num = parseInt(numberMatch[1])
    result.numQuestions = Math.min(Math.max(num, 1), 100) // Limit between 1-100
  }
  
  // Also check for just a number followed by these words
  const numOnlyMatch = lowerInstructions.match(/(\d+)\s*(?:intrebari|questions|inrebari|intrebări)\s*(?:din|from)?\s*(\d+)?/)
  if (numOnlyMatch && !numberMatch) {
    const num = parseInt(numOnlyMatch[1])
    result.numQuestions = Math.min(Math.max(num, 1), 100)
  }
  
  // Check for explicit number at start (e.g., "50 intrebari" or "50 questions")
  const explicitNum = lowerInstructions.match(/^(\d+)\s+(intrebari|questions|inrebari|intrebări)/)
  if (explicitNum) {
    const num = parseInt(explicitNum[1])
    result.numQuestions = Math.min(Math.max(num, 1), 100)
  }
  
  // Extract question range - look for patterns like "1-288", "intrebari 1-288", etc.
  const rangeMatch = lowerInstructions.match(/(intrebari|questions|inrebari|intrebări)\s*(\d+)\s*-\s*(\d+)/)
  if (rangeMatch) {
    result.questionRange = `${rangeMatch[2]}-${rangeMatch[3]}`
  }
  
  // Also check for just a range pattern
  const simpleRangeMatch = lowerInstructions.match(/(\d+)\s*-\s*(\d+)/)
  if (simpleRangeMatch && !rangeMatch) {
    result.questionRange = `${simpleRangeMatch[1]}-${simpleRangeMatch[2]}`
  }

  // Check for "intrebarea X-Y" pattern
  const intrebareaRangeMatch = lowerInstructions.match(/intrebarea\s+(\d+)\s*-\s*(\d+)/)
  if (intrebareaRangeMatch) {
    result.questionRange = `${intrebareaRangeMatch[1]}-${intrebareaRangeMatch[2]}`
  }

  // Check for "from X to Y" pattern
  const fromToMatch = lowerInstructions.match(/(from|din|de la)\s+(\d+)\s+(to|pana la|la)\s+(\d+)/)
  if (fromToMatch) {
    result.questionRange = `${fromToMatch[2]}-${fromToMatch[4]}`
  }

  // Check for specific range like "questions 1 to 288"
  const questionsToMatch = lowerInstructions.match(/(\d+)\s+(to|pana|until)\s+(\d+)/)
  if (questionsToMatch && !result.questionRange) {
    result.questionRange = `${questionsToMatch[1]}-${questionsToMatch[3]}`
  }
  
  return result
}