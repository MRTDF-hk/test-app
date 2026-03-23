# Hybrid AI PDF Quiz Generator - Mobile Architecture

## Overview

This document describes the architecture for a hybrid AI mobile application that converts PDF files into multiple-choice quizzes in Romanian. The system combines local PDF processing with cloud-based AI quiz generation.

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Cloud API      │    │   AI Service    │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ PDF Reader  │ │    │ │ API Gateway  │ │    │ │ AI Model    │ │
│ │ (Local)     │ │    │ │ (OpenRouter) │ │    │ │ (GPT-4)     │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ Text        │ │    │ │ Text         │ │    │ │ Quiz JSON   │ │
│ │ Extractor   │ │───▶│ │ Processor    │ │───▶│ │ Generator   │ │
│ │ (Local)     │ │    │ │ (Cloud)      │ │    │ │ (AI)        │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │                 │
│ │ Quiz UI     │ │    │ │ Response     │ │    │                 │
│ │ (Local)     │ │◀───│ │ Handler      │ │◀───│                 │
│ └─────────────┘ │    │ └──────────────┘ │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Technology Stack

### Mobile Application
- **Framework**: Flutter (Recommended) or React Native
- **PDF Processing**: 
  - Flutter: `pdf_text` or `syncfusion_pdfviewer`
  - React Native: `react-native-pdf` or `react-native-pdf-lib`
- **HTTP Client**: 
  - Flutter: `dio`
  - React Native: `axios` or `fetch`
- **State Management**: Provider (Flutter) or Redux/Context (React Native)
- **UI Framework**: Material Design Components

### Backend API (Optional)
- **Language**: Node.js with Express
- **Framework**: Express.js
- **Environment**: Environment variables for API keys
- **Security**: API key management, rate limiting

### AI Service
- **Provider**: OpenRouter (Recommended)
- **Models**: GPT-4, Claude, or other available models
- **API**: RESTful JSON API
- **Language**: Romanian text processing

## Data Flow

### 1. PDF Upload and Processing
```
User selects PDF → Local extraction → Text cleaning → Size optimization
```

### 2. AI Quiz Generation
```
Text + Instructions → API Request → AI Processing → JSON Response
```

### 3. Quiz Display
```
JSON Quiz → UI Rendering → User Interaction → Feedback Display
```

## Component Architecture

### Mobile App Components

#### 1. PDF Processing Module
```dart
class PDFProcessor {
  Future<String> extractText(String filePath) async {
    // Local PDF text extraction
    // Text cleaning and optimization
    // Size limiting for API calls
  }
}
```

#### 2. API Communication Module
```dart
class QuizGeneratorAPI {
  Future<QuizResponse> generateQuiz(
    String text, 
    String instructions
  ) async {
    // HTTP request to OpenRouter API
    // Error handling and retries
    // Response parsing
  }
}
```

#### 3. Quiz UI Module
```dart
class QuizScreen {
  // Question display
  // Answer selection
  // Feedback animation
  // Score tracking
}
```

### Backend API Components (Optional)

#### 1. API Gateway
```javascript
app.post('/api/generate-quiz', async (req, res) => {
  const { text, instructions } = req.body;
  // Validation
  // API key management
  // Forward to OpenRouter
});
```

#### 2. Security Layer
```javascript
// Rate limiting
// API key validation
// Input sanitization
// CORS configuration
```

## Implementation Details

### PDF Text Extraction

#### Flutter Implementation
```yaml
# pubspec.yaml
dependencies:
  pdf_text: ^0.3.0
  dio: ^5.0.0
```

```dart
import 'package:pdf_text/pdf_text.dart';

class PDFProcessor {
  Future<String> extractText(String filePath) async {
    final pdf = PDFDocument.fromFile(File(filePath));
    final pages = await pdf.pages;
    
    String fullText = '';
    for (var page in pages) {
      final text = await page.text;
      fullText += text + '\n';
    }
    
    return cleanText(fullText);
  }
  
  String cleanText(String text) {
    // Remove extra whitespace
    // Limit text size
    // Handle encoding issues
    return text.trim();
  }
}
```

#### React Native Implementation
```javascript
import RNFS from 'react-native-fs';
import { PDFDocument } from 'pdf-lib';

class PDFProcessor {
  async extractText(filePath) {
    try {
      const pdfBuffer = await RNFS.readFile(filePath, 'base64');
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      
      let fullText = '';
      const pages = pdfDoc.getPages();
      
      for (const page of pages) {
        // Text extraction logic
        // Note: React Native may need additional libraries
        // for full text extraction
      }
      
      return this.cleanText(fullText);
    } catch (error) {
      throw new Error('Failed to extract text from PDF');
    }
  }
}
```

### API Integration

#### OpenRouter API Configuration
```javascript
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

class QuizGeneratorAPI {
  async generateQuiz(text, instructions = '') {
    const prompt = this.buildPrompt(text, instructions);
    
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://your-app.com',
        'X-Title': 'PDF Quiz Generator'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-sonnet',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    const data = await response.json();
    return this.parseQuizResponse(data);
  }
  
  buildPrompt(text, instructions) {
    return `
      Extrage textul din următorul document PDF și creează un test cu întrebări cu răspunsuri multiple în limba română:

      Text PDF:
      ${text.substring(0, 5000)} // Limit text size

      ${instructions ? `Instrucțiuni suplimentare: ${instructions}` : ''}

      Returnează un JSON cu structura:
      [
        {
          "question": "Întrebare în română",
          "options": ["A. Răspuns 1", "B. Răspuns 2", "C. Răspuns 3", "D. Răspuns 4"],
          "correctAnswer": "A"
        }
      ]

      Asigură-te că:
      - Toate întrebările sunt în limba română
      - Există exact 4 variante de răspuns
      - Doar un răspuns este corect
      - Răspunsurile sunt clare și concise
    `;
  }
}
```

### Quiz UI Implementation

#### Flutter Quiz Screen
```dart
class QuizScreen extends StatefulWidget {
  final List<QuizQuestion> questions;
  
  QuizScreen({required this.questions});
  
  @override
  _QuizScreenState createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  int currentQuestionIndex = 0;
  Map<int, String> userAnswers = {};
  bool showFeedback = false;
  
  @override
  Widget build(BuildContext context) {
    final question = widget.questions[currentQuestionIndex];
    
    return Scaffold(
      appBar: AppBar(
        title: Text('Test PDF'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: () => setState(() {
              currentQuestionIndex = 0;
              userAnswers.clear();
              showFeedback = false;
            }),
          )
        ],
      ),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Question counter
            Text(
              'Întrebarea ${currentQuestionIndex + 1} din ${widget.questions.length}',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            
            // Question text
            Text(
              question.question,
              style: TextStyle(fontSize: 16),
            ),
            
            SizedBox(height: 20),
            
            // Answer options
            Column(
              children: question.options.map((option) {
                final isSelected = userAnswers[currentQuestionIndex] == option[0];
                final isCorrect = option[0] == question.correctAnswer;
                final isWrong = isSelected && !isCorrect;
                
                Color getBackgroundColor() {
                  if (showFeedback) {
                    if (isCorrect) return Colors.green.withOpacity(0.2);
                    if (isWrong) return Colors.red.withOpacity(0.2);
                  }
                  return isSelected ? Colors.blue.withOpacity(0.1) : Colors.transparent;
                }
                
                return Container(
                  margin: EdgeInsets.symmetric(vertical: 4),
                  decoration: BoxDecoration(
                    color: getBackgroundColor(),
                    border: Border.all(color: Colors.grey),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: ListTile(
                    title: Text(option),
                    onTap: () {
                      if (!showFeedback) {
                        setState(() {
                          userAnswers[currentQuestionIndex] = option[0];
                        });
                      }
                    },
                  ),
                );
              }).toList(),
            ),
            
            Spacer(),
            
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      if (userAnswers[currentQuestionIndex] != null) {
                        setState(() {
                          showFeedback = true;
                        });
                      }
                    },
                    child: Text('Vezi răspunsul corect'),
                  ),
                ),
                SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      if (currentQuestionIndex < widget.questions.length - 1) {
                        setState(() {
                          currentQuestionIndex++;
                          showFeedback = false;
                        });
                      }
                    },
                    child: Text('Următoarea întrebare'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

## Error Handling

### PDF Processing Errors
```dart
try {
  final text = await pdfProcessor.extractText(filePath);
  if (text.isEmpty) {
    throw Exception('PDF-ul nu conține text sau este corupt');
  }
  // Continue processing
} catch (e) {
  if (e is PlatformException) {
    showErrorMessage('Eroare la citirea fișierului PDF');
  } else {
    showErrorMessage('Eroare necunoscută la procesarea PDF-ului');
  }
}
```

### API Errors
```dart
try {
  final quiz = await api.generateQuiz(text, instructions);
  setState(() {
    this.quiz = quiz;
    isLoading = false;
  });
} catch (e) {
  if (e is TimeoutException) {
    showErrorMessage('Timeout la conexiunea cu serverul AI');
  } else if (e is SocketException) {
    showErrorMessage('Verifică conexiunea la internet');
  } else {
    showErrorMessage('Eroare la generarea testului. Încearcă din nou.');
  }
}
```

## Performance Optimization

### Text Size Management
```dart
String optimizeTextSize(String text, int maxSize = 5000) {
  if (text.length <= maxSize) return text;
  
  // Find last complete sentence before maxSize
  final truncated = text.substring(0, maxSize);
  final lastSentenceEnd = [
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?'),
  ].where((index) => index > 0).reduce(math.max);
  
  return lastSentenceEnd > 0 
    ? truncated.substring(0, lastSentenceEnd + 1)
    : truncated;
}
```

### Caching Strategy
```dart
class QuizCache {
  static const _cacheDuration = Duration(minutes: 30);
  final Map<String, CacheEntry> _cache = {};
  
  void set(String key, QuizResponse value) {
    _cache[key] = CacheEntry(
      data: value,
      timestamp: DateTime.now(),
    );
  }
  
  QuizResponse? get(String key) {
    final entry = _cache[key];
    if (entry == null) return null;
    
    if (DateTime.now().difference(entry.timestamp) > _cacheDuration) {
      _cache.remove(key);
      return null;
    }
    
    return entry.data;
  }
}
```

## Security Considerations

### API Key Management
```javascript
// Backend environment variables
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Frontend API calls through backend proxy
const response = await fetch('/api/generate-quiz', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, instructions })
});
```

### Input Validation
```javascript
function validateInput(text, instructions) {
  if (!text || text.trim().length === 0) {
    throw new Error('Textul PDF este gol');
  }
  
  if (text.length > 10000) {
    throw new Error('Textul este prea lung pentru procesare');
  }
  
  if (instructions && instructions.length > 500) {
    throw new Error('Instrucțiunile sunt prea lungi');
  }
}
```

## Deployment Considerations

### Mobile App Distribution
- **Android**: Google Play Store or direct APK distribution
- **iOS**: App Store (requires Apple Developer account)
- **Cross-platform**: Single codebase for both platforms

### Backend Hosting
- **Cloud Providers**: AWS, Google Cloud, Azure
- **Serverless**: Vercel, Netlify Functions
- **Container**: Docker with Kubernetes

### Monitoring and Analytics
- **Error Tracking**: Sentry, Firebase Crashlytics
- **Usage Analytics**: Google Analytics, Mixpanel
- **Performance Monitoring**: New Relic, DataDog

## Testing Strategy

### Unit Tests
```dart
void main() {
  group('PDFProcessor', () {
    test('should extract text from valid PDF', () async {
      final processor = PDFProcessor();
      final text = await processor.extractText('test.pdf');
      expect(text, isNotEmpty);
    });
    
    test('should handle empty PDF', () async {
      final processor = PDFProcessor();
      expect(() => processor.extractText('empty.pdf'), 
             throwsA(isA<Exception>()));
    });
  });
}
```

### Integration Tests
```javascript
describe('Quiz Generation API', () => {
  test('should generate quiz from PDF text', async () => {
    const response = await request(app)
      .post('/api/generate-quiz')
      .send({
        text: 'Sample PDF text content',
        instructions: 'Generate easy questions'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('questions');
    expect(response.body.questions).toBeInstanceOf(Array);
  });
});
```

### UI Tests
```dart
void main() {
  testWidgets('Quiz screen displays questions correctly', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: QuizScreen(questions: sampleQuestions)
      )
    );
    
    expect(find.text('Întrebarea 1 din 5'), findsOneWidget);
    expect(find.text('Sample question'), findsOneWidget);
  });
}
```

This architecture provides a robust, scalable solution for creating a hybrid AI mobile application that efficiently processes PDFs locally while leveraging cloud AI for quiz generation.