import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export async function POST(request: NextRequest) {
  try {
    // Check if request is multipart form data
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Se așteaptă un fișier PDF' },
        { status: 400 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const pdfFile = formData.get('pdfFile')

    if (!pdfFile || !(pdfFile instanceof File)) {
      return NextResponse.json(
        { error: 'Nu a fost încărcat niciun fișier PDF' },
        { status: 400 }
      )
    }

    // Validate file type
    if (pdfFile.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Tip de fișier neacceptat. Se acceptă doar PDF-uri.' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (pdfFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Fișierul este prea mare. Dimensiune maximă: 10MB' },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await pdfFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text from PDF
    let text: string
    try {
      const pdfData = await pdfParse(buffer)
      text = pdfData.text || ''
    } catch (error) {
      console.error('Eroare la parsarea PDF-ului:', error)
      return NextResponse.json(
        { error: 'Eroare la procesarea fișierului PDF. Fișier corupt sau nevalid.' },
        { status: 500 }
      )
    }

    // Validate extracted text
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nu s-a putut extrage text din PDF. Fișierul poate fi gol sau conține doar imagini.' },
        { status: 400 }
      )
    }

    // Limit text size to avoid serverless timeout (limit to ~15000 words)
    const words = text.split(/\s+/)
    const maxWords = 15000
    let processedText = text
    
    if (words.length > maxWords) {
      processedText = words.slice(0, maxWords).join(' ')
      processedText += '\n\n[Textul a fost trunchiat pentru a se încadra în limita de procesare]'
    }

    return NextResponse.json({
      success: true,
      text: processedText,
      originalSize: text.length,
      processedSize: processedText.length,
      fileName: pdfFile.name,
    })

  } catch (error) {
    console.error('Eroare la procesarea PDF-ului:', error)
    return NextResponse.json(
      { error: 'A apărut o eroare la procesarea fișierului PDF.' },
      { status: 500 }
    )
  }
}