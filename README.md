# TOEFL Speaking Practice Lab

A TOEFL speaking practice app built with static HTML/CSS/JavaScript on the frontend and Gemini-powered backend analysis. It runs locally with Node.js + Express, and it is also prepared for deployment on Vercel using serverless API routes.

## Features

- TOEFL-style speaking question bank
- 15-second prep timer and 45-second speaking timer
- Browser speech recognition in Chrome
- Transcript preview before analysis
- Gemini scoring for content, organization, and fluency
- Strengths, suggestions, and improved speaking structure
- Local Express server with `GET /api/health`
- Vercel Functions for `/api/health` and `/api/analyze-speaking`

## Requirements

- Node.js 18 or newer
- A Gemini API key
- Chrome for browser speech recognition

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_key_here
PORT=3000
```

3. Start the server:

```bash
npm start
```

4. Open the app:

[http://localhost:3000](http://localhost:3000)

If port 3000 is already in use, the server falls back to `http://localhost:3001`.

## How It Works

1. Open the local app in Chrome.
2. Start practice or click `Start Recording`.
3. The browser captures your speech and shows the transcript on the page.
4. Click `Analyze My Response`.
5. The frontend sends `{ question, transcript }` to `POST /api/analyze-speaking`.
6. The backend calls Gemini and returns TOEFL-style feedback as JSON.

## Notes

- The Gemini API key stays on the backend only.
- If speech recognition is unsupported, the app shows: `Speech recognition is not supported in this browser. Please use Chrome.`
- `npm start` runs `node server.js`.

## Deploy To Vercel

1. Push this project to a GitHub repository.

2. Go to [Vercel](https://vercel.com) and click `Add New...` → `Project`.

3. Import the GitHub repository.

4. In the Vercel project settings, add this environment variable:

```env
GEMINI_API_KEY=your_key_here
```

5. Deploy the project.

6. After deployment, Vercel will serve:
   - the homepage from `index.html`
   - the practice page from `practice.html`
   - the history pages from `history.html` and `history-detail.html`
   - the API from:
     - `/api/health`
     - `/api/analyze-speaking`

## Vercel Files

- `api/health.js`: Vercel Function health check
- `api/analyze-speaking.js`: Vercel Function for Gemini speaking analysis
- `lib/gemini-evaluator.js`: shared Gemini evaluation logic used by both Vercel and local Express
- `vercel.json`: Vercel runtime configuration
