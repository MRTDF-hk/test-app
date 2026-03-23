# PDF Quiz Generator - Setup Instructions

## Overview

This document provides step-by-step instructions to set up and run the PDF Quiz Generator application.

## Prerequisites

### Required Software
- **Node.js** (version 18 or higher)
- **npm** (version 8 or higher)
- **Git** (for cloning the repository)

### Optional for Development
- **Visual Studio Code** (recommended IDE)
- **Postman** (for API testing)

## Installation Steps

### 1. Clone the Repository
```bash
git clone <repository-url>
cd pdf-quiz-generator
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env.local` file in the root directory:
```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

**How to get an OpenRouter API Key:**
1. Go to [OpenRouter.ai](https://openrouter.ai)
2. Sign up for a free account
3. Navigate to your dashboard
4. Generate a new API key
5. Copy the key to your `.env.local` file

### 4. Run the Development Server
```bash
npm run dev
```

The application will start on `http://localhost:3000`

## Project Structure

```
pdf-quiz-generator/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/               # API routes
│   │   │   ├── generate-quiz/ # Quiz generation endpoint
│   │   │   ├── health/        # Health check endpoint
│   │   │   └── process-pdf/   # PDF processing endpoint
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout component
│   │   └── page.tsx          # Main page component
│   └── components/            # React components
│       ├── FileUpload.tsx     # PDF upload component
│       ├── QuizDisplay.tsx    # Quiz display component
│       ├── QuizGenerator.tsx  # Quiz generation logic
│       └── QuizQuestion.tsx   # Individual question component
├── public/                    # Static assets
├── .env.local                 # Environment variables
├── .gitignore                 # Git ignore rules
├── package.json               # Project dependencies
├── README.md                  # Project documentation
└── tailwind.config.ts         # Tailwind CSS configuration
```

## Running the Application

### Development Mode
```bash
npm run dev
```
- Starts the development server
- Enables hot reloading
- Runs on `http://localhost:3000`

### Production Build
```bash
npm run build
npm start
```
- Creates an optimized production build
- Starts the production server
- Serves on `http://localhost:3000`

### Testing
```bash
npm test
```
- Runs the test suite
- Currently includes basic API endpoint tests

## Using the Application

### 1. Upload a PDF
1. Open the application in your browser
2. Click "Alege fișier PDF" button
3. Select a PDF file from your device
4. The file will be processed automatically

### 2. Generate Quiz
1. After PDF processing, you'll see the extracted text
2. Optionally add custom instructions for the AI
3. Click "Generează test" to create the quiz
4. Wait for the AI to process and return the quiz

### 3. Take the Quiz
1. Questions will be displayed one at a time
2. Select your answer from the multiple-choice options
3. Click "Vezi răspunsul corect" to check your answer
4. Click "Mai încearcă o dată" to restart the quiz

## API Endpoints

### Health Check
```
GET /api/health
```
Returns: `{"status": "ok"}`

### PDF Processing
```
POST /api/process-pdf
Content-Type: multipart/form-data
```
Body: PDF file upload
Returns: Extracted text from the PDF

### Quiz Generation
```
POST /api/generate-quiz
Content-Type: application/json
```
Body:
```json
{
  "text": "Extracted PDF text content",
  "instructions": "Optional custom instructions"
}
```
Returns: Generated quiz in JSON format

## Mobile App Setup (Flutter)

### Prerequisites for Mobile Development
- **Flutter SDK** (latest stable version)
- **Android Studio** or **Xcode** (for platform-specific development)
- **Dart** programming knowledge

### 1. Create Flutter Project
```bash
flutter create pdf_quiz_app
cd pdf_quiz_app
```

### 2. Add Dependencies
Add to `pubspec.yaml`:
```yaml
dependencies:
  flutter:
    sdk: flutter
  pdf_text: ^0.3.0
  dio: ^5.0.0
  http: ^1.2.0
  provider: ^6.1.0
```

### 3. Run Flutter App
```bash
flutter pub get
flutter run
```

## Mobile App Setup (React Native)

### Prerequisites for Mobile Development
- **React Native CLI** or **Expo CLI**
- **Node.js** (version 16 or higher)
- **Xcode** (iOS) or **Android Studio** (Android)

### 1. Create React Native Project
```bash
npx react-native init PDFQuizApp
cd PDFQuizApp
```

### 2. Add Dependencies
```bash
npm install react-native-pdf react-native-fs axios
```

### 3. Run React Native App
```bash
npx react-native run-android
# or
npx react-native run-ios
```

## Troubleshooting

### Common Issues

#### 1. API Key Not Found
**Error**: `OPENROUTER_API_KEY is required`
**Solution**: 
- Ensure `.env.local` file exists
- Verify the API key is correctly formatted
- Restart the development server after making changes

#### 2. PDF Upload Fails
**Error**: `Failed to process PDF file`
**Solution**:
- Check if the file is a valid PDF
- Ensure the file size is reasonable (< 10MB)
- Verify file permissions

#### 3. AI Generation Timeout
**Error**: `Request timeout`
**Solution**:
- Check internet connection
- Try with a smaller PDF file
- Verify API key has sufficient credits

#### 4. CORS Issues (Mobile)
**Error**: `CORS policy blocked`
**Solution**:
- Use backend proxy for API calls
- Configure CORS headers on the server
- Use HTTPS for production

### Development Tips

#### 1. Debugging API Calls
Use browser developer tools to:
- Monitor network requests
- Check API responses
- View console errors

#### 2. Testing PDF Processing
- Use sample PDF files with known content
- Test with different PDF formats
- Verify text extraction quality

#### 3. Performance Optimization
- Limit PDF file size before processing
- Implement caching for quiz results
- Use lazy loading for large quizzes

## Deployment

### Web Application
1. **Vercel** (Recommended):
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Netlify**:
   ```bash
   npm run build
   # Deploy build folder to Netlify
   ```

3. **AWS/GCP/Azure**:
   - Use container deployment
   - Configure environment variables
   - Set up SSL certificates

### Mobile Application
1. **Android**:
   - Generate signed APK
   - Submit to Google Play Store
   - Follow Google's app guidelines

2. **iOS**:
   - Create Apple Developer account
   - Generate app certificates
   - Submit to App Store

## Environment Variables

### Required
- `OPENROUTER_API_KEY`: OpenRouter API key for AI quiz generation

### Optional
- `API_BASE_URL`: Custom API base URL (for development)
- `MAX_FILE_SIZE`: Maximum allowed file size in bytes
- `TIMEOUT_DURATION`: API timeout in milliseconds

## Security Notes

1. **API Keys**: Never commit API keys to version control
2. **File Uploads**: Validate file types and sizes
3. **HTTPS**: Always use HTTPS in production
4. **Input Validation**: Sanitize all user inputs

## Support

For additional help:
1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review the [API Documentation](https://openrouter.ai/docs)
3. Join our [Discord Community](https://discord.gg/your-community)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.