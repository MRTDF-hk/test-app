# API Examples and Documentation

## Overview

This document provides detailed examples of API requests and responses for the PDF Quiz Generator application.

## API Endpoints

### 1. Health Check Endpoint

**URL**: `GET /api/health`

**Purpose**: Check if the API is running and healthy

**Request Example**:
```bash
curl -X GET http://localhost:3000/api/health
```

**Response Example**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

**Response Codes**:
- `200` - API is healthy
- `500` - API is experiencing issues

---

### 2. PDF Processing Endpoint

**URL**: `POST /api/process-pdf`

**Purpose**: Extract text from uploaded PDF files

**Request Headers**:
```
Content-Type: multipart/form-data
```

**Request Body**: Form data with PDF file
```
file: [PDF file upload]
```

**Request Example (cURL)**:
```bash
curl -X POST http://localhost:3000/api/process-pdf \
  -F "file=@sample-document.pdf"
```

**Request Example (JavaScript)**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('/api/process-pdf', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

**Request Example (Python)**:
```python
import requests

url = 'http://localhost:3000/api/process-pdf'
files = {'file': open('sample-document.pdf', 'rb')}

response = requests.post(url, files=files)
print(response.json())
```

**Success Response Example**:
```json
{
  "success": true,
  "text": "Aceasta este o mostră de text extras dintr-un document PDF. Documentul conține informații importante despre subiectul tratat. Textul este procesat pentru a fi utilizat în generarea de întrebări cu răspunsuri multiple.",
  "metadata": {
    "fileName": "sample-document.pdf",
    "fileSize": 102400,
    "extractedAt": "2024-01-15T10:30:00.000Z",
    "characterCount": 2450,
    "wordCount": 420
  }
}
```

**Error Response Examples**:

*Invalid file type*:
```json
{
  "success": false,
  "error": "Invalid file type. Please upload a PDF file.",
  "code": "INVALID_FILE_TYPE"
}
```

*File too large*:
```json
{
  "success": false,
  "error": "File size exceeds maximum limit of 10MB.",
  "code": "FILE_TOO_LARGE"
}
```

*Processing error*:
```json
{
  "success": false,
  "error": "Failed to extract text from PDF file.",
  "code": "PROCESSING_ERROR"
}
```

**Response Codes**:
- `200` - PDF processed successfully
- `400` - Bad request (invalid file, missing file, etc.)
- `413` - File too large
- `500` - Internal server error

---

### 3. Quiz Generation Endpoint

**URL**: `POST /api/generate-quiz`

**Purpose**: Generate multiple-choice quiz from extracted text

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**: JSON with text and optional instructions
```json
{
  "text": "Text extracted from PDF document...",
  "instructions": "Generate easy questions focusing on key concepts"
}
```

**Request Example (cURL)**:
```bash
curl -X POST http://localhost:3000/api/generate-quiz \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Aceasta este o mostră de text extras dintr-un document PDF...",
    "instructions": "Generează întrebări ușoare"
  }'
```

**Request Example (JavaScript)**:
```javascript
const quizData = {
  text: "Text extracted from PDF...",
  instructions: "Generate easy questions"
};

fetch('/api/generate-quiz', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(quizData)
})
.then(response => response.json())
.then(data => console.log(data));
```

**Request Example (Python)**:
```python
import requests
import json

url = 'http://localhost:3000/api/generate-quiz'
data = {
  'text': 'Text extracted from PDF...',
  'instructions': 'Generate easy questions'
}

response = requests.post(url, json=data)
print(response.json())
```

**Success Response Example**:
```json
{
  "success": true,
  "quiz": [
    {
      "question": "Care este principala temă abordată în acest document?",
      "options": [
        "A. Procesarea documentelor PDF",
        "B. Generarea de teste cu răspunsuri multiple",
        "C. Inteligența artificială în educație",
        "D. Tehnologii mobile moderne"
      ],
      "correctAnswer": "A",
      "explanation": "Documentul se concentrează pe procesarea documentelor PDF pentru generarea de teste."
    },
    {
      "question": "Ce tip de aplicație este descrisă în acest proiect?",
      "options": [
        "A. Aplicație web statică",
        "B. Aplicație mobilă hibridă",
        "C. Aplicație desktop nativă",
        "D. Joc educativ"
      ],
      "correctAnswer": "B",
      "explanation": "Proiectul descrie o aplicație mobilă hibridă care combină procesare locală cu AI cloud."
    },
    {
      "question": "Care este limbajul principal de afișare al testelor generate?",
      "options": [
        "A. Engleză",
        "B. Română",
        "C. Franceză",
        "D. Germană"
      ],
      "correctAnswer": "B",
      "explanation": "Testele sunt generate în limba română conform cerințelor proiectului."
    }
  ],
  "metadata": {
    "questionCount": 3,
    "difficulty": "easy",
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "processingTime": 2450
  }
}
```

**Error Response Examples**:

*Missing text*:
```json
{
  "success": false,
  "error": "Text content is required for quiz generation.",
  "code": "MISSING_TEXT"
}
```

*Text too short*:
```json
{
  "success": false,
  "error": "Text content is too short to generate meaningful questions.",
  "code": "TEXT_TOO_SHORT"
}
```

*AI API error*:
```json
{
  "success": false,
  "error": "Failed to generate quiz. Please try again later.",
  "code": "AI_GENERATION_ERROR",
  "details": "OpenRouter API returned error: Rate limit exceeded"
}
```

*Timeout error*:
```json
{
  "success": false,
  "error": "Quiz generation timed out. Please try with a shorter text.",
  "code": "TIMEOUT_ERROR"
}
```

**Response Codes**:
- `200` - Quiz generated successfully
- `400` - Bad request (missing text, invalid format, etc.)
- `500` - Internal server error (AI API failure, etc.)
- `504` - Gateway timeout

---

## Complete Workflow Example

### Step 1: Upload and Process PDF
```bash
# Upload PDF file
curl -X POST http://localhost:3000/api/process-pdf \
  -F "file=@biology-textbook.pdf" \
  -o process-response.json
```

**process-response.json**:
```json
{
  "success": true,
  "text": "Biologia este știința care studiază ființele vii și procesele vitale. Celula este unitatea fundamentală a vieții...",
  "metadata": {
    "fileName": "biology-textbook.pdf",
    "fileSize": 2048000,
    "extractedAt": "2024-01-15T10:30:00.000Z",
    "characterCount": 15000,
    "wordCount": 2500
  }
}
```

### Step 2: Generate Quiz
```bash
# Generate quiz from extracted text
curl -X POST http://localhost:3000/api/generate-quiz \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Biologia este știința care studiază ființele vii și procesele vitale. Celula este unitatea fundamentală a vieții...",
    "instructions": "Generează întrebări de nivel mediu despre conceptele de bază din biologie"
  }' \
  -o quiz-response.json
```

**quiz-response.json**:
```json
{
  "success": true,
  "quiz": [
    {
      "question": "Care este unitatea fundamentală a vieții conform textului?",
      "options": [
        "A. Atomul",
        "B. Molecula",
        "C. Celula",
        "D. Organul"
      ],
      "correctAnswer": "C",
      "explanation": "Textul menționează că celula este unitatea fundamentală a vieții."
    },
    {
      "question": "Ce studiază biologia conform definiției din text?",
      "options": [
        "A. Procesele chimice",
        "B. Ființele vii și procesele vitale",
        "C. Structurile atomice",
        "D. Fenomenele fizice"
      ],
      "correctAnswer": "B",
      "explanation": "Biologia este definită ca știința care studiază ființele vii și procesele vitale."
    }
  ],
  "metadata": {
    "questionCount": 2,
    "difficulty": "medium",
    "generatedAt": "2024-01-15T10:30:02.000Z",
    "processingTime": 1800
  }
}
```

---

## Error Handling Examples

### Client-Side Error Handling (JavaScript)
```javascript
async function processPDF(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/process-pdf', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.text;
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}

async function generateQuiz(text, instructions) {
  try {
    const response = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, instructions })
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error('Invalid request parameters');
      } else if (response.status === 500) {
        throw new Error('Server error, please try again later');
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.quiz;
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw error;
  }
}
```

### Server-Side Error Handling (Node.js)
```javascript
// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    error: error.message,
    code: error.code || 'INTERNAL_SERVER_ERROR',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Specific error classes
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.code = 'VALIDATION_ERROR';
  }
}

class ProcessingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProcessingError';
    this.status = 500;
    this.code = 'PROCESSING_ERROR';
  }
}
```

---

## Rate Limiting and Best Practices

### Rate Limiting Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1642262400
```

### Best Practices for API Usage

1. **Handle Errors Gracefully**:
   - Always check the `success` field in responses
   - Implement retry logic for transient errors
   - Provide user-friendly error messages

2. **Optimize File Uploads**:
   - Compress PDF files before upload when possible
   - Implement progress indicators for large files
   - Set appropriate timeout values

3. **Cache Results**:
   - Cache quiz results to avoid regenerating the same quiz
   - Implement cache invalidation strategies
   - Consider user-specific caching

4. **Monitor Usage**:
   - Track API response times
   - Monitor error rates
   - Set up alerts for unusual activity

5. **Security Considerations**:
   - Validate all input data
   - Use HTTPS in production
   - Implement proper authentication if needed
   - Sanitize file uploads

---

## Mobile App Integration Examples

### Flutter Integration
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class QuizAPI {
  static const baseUrl = 'http://localhost:3000/api';

  Future<String> processPDF(File file) async {
    final uri = Uri.parse('$baseUrl/process-pdf');
    final request = http.MultipartRequest('POST', uri);
    
    request.files.add(
      await http.MultipartFile.fromPath('file', file.path)
    );

    final response = await request.send();
    
    if (response.statusCode == 200) {
      final responseString = await response.stream.bytesToString();
      final result = jsonDecode(responseString);
      return result['text'];
    } else {
      throw Exception('Failed to process PDF');
    }
  }

  Future<List<QuizQuestion>> generateQuiz(String text, String instructions) async {
    final uri = Uri.parse('$baseUrl/generate-quiz');
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'text': text,
        'instructions': instructions
      })
    );

    if (response.statusCode == 200) {
      final result = jsonDecode(response.body);
      return (result['quiz'] as List)
          .map((q) => QuizQuestion.fromJson(q))
          .toList();
    } else {
      throw Exception('Failed to generate quiz');
    }
  }
}
```

### React Native Integration
```javascript
class QuizAPI {
  static baseUrl = 'http://localhost:3000/api';

  static async processPDF(file) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: 'application/pdf',
      name: file.name
    });

    const response = await fetch(`${this.baseUrl}/process-pdf`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      return result.text;
    } else {
      throw new Error(result.error);
    }
  }

  static async generateQuiz(text, instructions) {
    const response = await fetch(`${this.baseUrl}/generate-quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, instructions })
    });

    const result = await response.json();
    
    if (result.success) {
      return result.quiz;
    } else {
      throw new Error(result.error);
    }
  }
}
```

This comprehensive API documentation provides all the necessary information for integrating the PDF Quiz Generator into various applications and platforms.