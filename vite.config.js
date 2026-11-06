
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import aiHandler from './api/ai.js';

const localAiApi = {
  name: 'local-ai-api',
  configureServer(server) {
    server.middlewares.use('/api/ai', async (request, nodeResponse) => {
      const response = {
        status(statusCode) {
          nodeResponse.statusCode = statusCode;
          return this;
        },
        json(body) {
          nodeResponse.setHeader('Content-Type', 'application/json');
          nodeResponse.end(JSON.stringify(body));
          return this;
        },
        setHeader(name, value) {
          nodeResponse.setHeader(name, value);
        },
      };

      try {
        await aiHandler(request, response);
      } catch (error) {
        console.error('Local AI endpoint failed:', error);
        if (!nodeResponse.writableEnded) {
          nodeResponse.statusCode = 500;
          nodeResponse.end(JSON.stringify({ error: 'AI request failed unexpectedly.' }));
        }
      }
    });
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'development') {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    process.env.FIREBASE_PROJECT_ID = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '';
  }
  for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON']) {
    if (env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [react(), localAiApi],
  };
});
