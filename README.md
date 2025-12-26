# SSC CGL Command Center

A React application for SSC CGL study planning and tracking, powered by AI.

## Features

- User authentication (Sign up / Login)
- Personal study session tracking
- AI-powered planning and analysis
- Firebase integration for secure data persistence
- Responsive design with Tailwind CSS

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your API keys (see .env.example)
4. Run development server: `npm run dev`
5. Build for production: `npm run build`

## Environment Variables

Create a `.env` file in the root directory with:

```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_GEMINI_API_KEY=your_gemini_api_key
```

## Deployment

This is a static site that can be deployed to Vercel, Netlify, or any static hosting service.

For Vercel: Connect your GitHub repo and deploy automatically.

For Netlify: Drag and drop the `dist` folder after building.