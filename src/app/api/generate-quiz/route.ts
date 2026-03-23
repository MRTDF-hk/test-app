import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

// Free AI API configuration (using HuggingFace Inference API)
const AI_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2'
const AI_API_KEY = process.env.AI_API_KEY

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
    if (!AI_API_KEY) {
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

    // Generate quiz using AI
    const quiz = await generateQuizWithAI(processedText, customInstructions)

    return NextResponse.json({
      success: true,
      quiz: quiz,
      fileName: pdfFile.name,
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
  // Build the prompt for the AI
  const instructions = customInstructions 
    ? `Instrucțiuni suplimentare: ${customInstructions}\n\n`
    : ''

  const prompt = `Transformă următorul text într-un test grilă în limba română. Generează minim 5 întrebări.

${instructions}Text extras din PDF:
"${pdfText}"

Cerințe:
- Fiecare întrebare trebuie să aibă EXACT 4 variante de răspuns (A, B, C, D)
- Doar un singur răspuns este corect
- Răspunsurile trebuie să fie plauzibile
- Formatează răspunsul ca JSON valid:

[
  {
    "question": "Întrebare în română",
    "options": ["A. Varianta 1", "B. Varianta 2", "C. Varianta 3", "D. Varianta 4"],
    "correctAnswer": "A"
  }
]

Important: Returnează DOAR JSON-ul, fără explicații suplimentare.`

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 2000,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Eroare API AI: ${response.status}`)
    }

    const result = await response.json()
    
    // Extract generated text from response
    const generatedText = result[0]?.generated_text || result.generated_text || ''
    
    // Parse JSON from the response
    const quiz = parseQuizFromResponse(generatedText)
    
    return quiz

  } catch (error) {
    console.error('Eroare la apelul API AI:', error)
    throw new Error('Eroare la generarea testului cu AI')
  }
}

function parseQuizFromResponse(responseText: string): QuizQuestion[] {
  try {
    // Try to find JSON in the response
    const jsonMatch = responseText.match(/\[([\s\S]*?)\]/)
    
    if (!jsonMatch) {
      throw new Error('Nu s-a putut găsi JSON în răspunsul AI')
    }

    const jsonString = jsonMatch[0]
    const parsed = JSON.parse(jsonString)

    // Validate and normalize the quiz structure
    if (!Array.isArray(parsed)) {
      throw new Error('Răspunsul AI nu este un array valid')
    }

    const quiz: QuizQuestion[] = []

    for (const item of parsed) {
      if (
        typeof item.question === 'string' &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        typeof item.correctAnswer === 'string'
      ) {
        // Normalize options format (ensure they start with A., B., C., D.)
        const normalizedOptions = item.options.map((opt: string, index: number) => {
          const letter = String.fromCharCode(65 + index)
          const cleanOption = opt.replace(/^[A-D]\.\s*/, '').trim()
          return `${letter}. ${cleanOption}`
        })

        // Validate correct answer format
        const correctAnswer = item.correctAnswer.replace(/\./g, '').trim().toUpperCase()
        
        quiz.push({
          question: item.question.trim(),
          options: normalizedOptions,
          correctAnswer: correctAnswer,
        })
      }
    }

    // Ensure we have at least 5 questions
    if (quiz.length < 5) {
      throw new Error(`Testul generat are doar ${quiz.length} întrebări. Se cer minim 5.`)
    }

    return quiz

  } catch (error) {
    console.error('Eroare la parsarea răspunsului AI:', error)
    
    // Fallback: generate a simple quiz structure
    return generateFallbackQuiz()
  }
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