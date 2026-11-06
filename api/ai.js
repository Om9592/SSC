import { createHash } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const MAX_BODY_BYTES = 4_500_000;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const DAILY_REQUEST_LIMIT = 18;
const USER_DAILY_REQUEST_LIMIT = 8;
const FALLBACK_GEMINI_MODEL = 'gemini-flash-lite-latest';
const localResponseCache = new Map();
const localUsage = new Map();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const getAdminServices = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!projectId) {
    throw new HttpError(503, 'AI service is not configured. Set FIREBASE_PROJECT_ID on the server.');
  }
  if (!serviceAccountJson && (process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true')) {
    throw new HttpError(503, 'AI service is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON in Netlify function environment variables.');
  }

  let serviceAccount;
  if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new HttpError(503, 'Firebase server credentials are invalid. Check FIREBASE_SERVICE_ACCOUNT_JSON.');
    }
  }

  const app = getApps().find(item => item.name === 'ai-api')
    || initializeApp({
      projectId,
      ...(serviceAccount ? { credential: cert(serviceAccount) } : {}),
    }, 'ai-api');
  return {
    auth: getAuth(app),
    db: serviceAccount ? getFirestore(app) : null,
  };
};

const readRequestBody = async (request) => {
  if (request.body && typeof request.body === 'object') return request.body;

  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw new HttpError(413, 'Request is too large. Keep uploaded documents under 3 MB.');
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
};

const reserveDailyRequest = async (db, uid) => {
  const day = new Date().toISOString().slice(0, 10);
  const dailyRef = db.collection('_aiUsage').doc(day);
  const userRef = dailyRef.collection('users').doc(uid);

  await db.runTransaction(async transaction => {
    const [dailySnapshot, userSnapshot] = await transaction.getAll(dailyRef, userRef);
    const dailyCount = dailySnapshot.data()?.count || 0;
    const userCount = userSnapshot.data()?.count || 0;

    if (dailyCount >= DAILY_REQUEST_LIMIT) {
      throw new HttpError(429, 'The app has reached its shared Gemini free-tier allowance for today. Please try again tomorrow.');
    }
    if (userCount >= USER_DAILY_REQUEST_LIMIT) {
      throw new HttpError(429, 'You have reached your 8 AI requests for today. Cached results do not count toward this limit.');
    }

    transaction.set(dailyRef, { count: dailyCount + 1, date: day }, { merge: true });
    transaction.set(userRef, { count: userCount + 1, uid }, { merge: true });
  });

  return { dailyRef, userRef };
};

const releaseDailyRequest = async (db, refs) => {
  await db.runTransaction(async transaction => {
    const [dailySnapshot, userSnapshot] = await transaction.getAll(refs.dailyRef, refs.userRef);
    transaction.set(refs.dailyRef, { count: Math.max(0, (dailySnapshot.data()?.count || 0) - 1) }, { merge: true });
    transaction.set(refs.userRef, { count: Math.max(0, (userSnapshot.data()?.count || 0) - 1) }, { merge: true });
  });
};

const reserveLocalRequest = (uid) => {
  const day = new Date().toISOString().slice(0, 10);
  const dailyKey = `daily:${day}`;
  const userKey = `${day}:${uid}`;
  const dailyCount = localUsage.get(dailyKey) || 0;
  const userCount = localUsage.get(userKey) || 0;
  if (dailyCount >= DAILY_REQUEST_LIMIT) {
    throw new HttpError(429, 'The local AI request allowance has been reached for today.');
  }
  if (userCount >= USER_DAILY_REQUEST_LIMIT) {
    throw new HttpError(429, 'You have reached your 8 AI requests for today. Cached results do not count toward this limit.');
  }
  localUsage.set(dailyKey, dailyCount + 1);
  localUsage.set(userKey, userCount + 1);
  return { dailyKey, userKey };
};

const releaseLocalRequest = (refs) => {
  localUsage.set(refs.dailyKey, Math.max(0, (localUsage.get(refs.dailyKey) || 0) - 1));
  localUsage.set(refs.userKey, Math.max(0, (localUsage.get(refs.userKey) || 0) - 1));
};

const callGemini = async ({ prompt, systemInstruction, inlineData }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const setup = process.env.NETLIFY === 'true'
      ? 'Set GEMINI_API_KEY in Netlify function environment variables, then redeploy.'
      : 'Set GEMINI_API_KEY in the project-root .env file, then restart the dev server.';
    throw new HttpError(503, `Gemini is not configured. ${setup}`);
  }

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const requestModel = async (modelName, timeoutMs) => {
    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                ...(inlineData ? [{ inline_data: inlineData }] : []),
              ],
            }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { maxOutputTokens: 8192 },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        }
      );
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new HttpError(504, 'Gemini took too long to respond. Please try again.');
      }
      throw new HttpError(502, 'Could not connect to Gemini. Check the server connection and try again.');
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new HttpError(502, 'Gemini returned an unreadable response. Please try again.');
    }
    return { response, result };
  };

  let attempt;
  try {
    attempt = await requestModel(model, 15000);
  } catch (error) {
    if (model === FALLBACK_GEMINI_MODEL
      || !(error instanceof HttpError)
      || ![502, 504].includes(error.status)) {
      throw error;
    }
    attempt = await requestModel(FALLBACK_GEMINI_MODEL, 45000);
  }

  let { response, result } = attempt;
  if (response.status >= 500 && model !== FALLBACK_GEMINI_MODEL) {
    ({ response, result } = await requestModel(FALLBACK_GEMINI_MODEL, 45000));
  }

  if (!response.ok || result.error) {
    if (response.status === 429) {
      throw new HttpError(429, 'Gemini free-tier quota is exhausted. It will be available again after the provider quota resets.');
    }
    if (response.status >= 500) {
      throw new HttpError(503, 'Gemini is temporarily unavailable. Please try again shortly.');
    }
    console.error('Gemini request rejected:', response.status, result.error?.message || 'Unknown provider error');
    throw new HttpError(502, 'Gemini rejected the request. Check the model, API key, and AI Studio settings.');
  }

  const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!text) {
    throw new HttpError(502, 'Gemini returned no text. Please try again.');
  }
  return text;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const authorization = request.headers.authorization || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new HttpError(401, 'Sign in to use AI features.');

    const { auth, db } = getAdminServices();
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(match[1]);
    } catch {
      throw new HttpError(401, 'Your sign-in has expired. Sign in again and retry.');
    }

    const body = await readRequestBody(request);
    const { prompt, systemInstruction, inlineData } = body || {};
    if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 30000) {
      throw new HttpError(400, 'Prompt is required and must be 30,000 characters or fewer.');
    }
    if (typeof systemInstruction !== 'string' || systemInstruction.length > 12000) {
      throw new HttpError(400, 'System instruction is required and must be 12,000 characters or fewer.');
    }
    if (inlineData) {
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(inlineData.mime_type)
        || typeof inlineData.data !== 'string'
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(inlineData.data)
        || Math.floor(inlineData.data.length * 3 / 4) > MAX_FILE_BYTES) {
        throw new HttpError(400, 'Unsupported or oversized file. Use a PDF, JPEG, PNG, or WebP under 3 MB.');
      }
    }

    const cacheKey = createHash('sha256')
      .update(JSON.stringify({ prompt, systemInstruction, inlineData }))
      .digest('hex');
    const localCacheKey = `${decodedToken.uid}:${cacheKey}`;
    const cacheRef = db
      ? db.collection('users').doc(decodedToken.uid).collection('aiResponseCache').doc(cacheKey)
      : null;
    const cachedText = cacheRef
      ? (await cacheRef.get()).data()?.text
      : localResponseCache.get(localCacheKey);
    if (typeof cachedText === 'string') {
      return response.status(200).json({ text: cachedText, cached: true });
    }

    const quotaRefs = db
      ? await reserveDailyRequest(db, decodedToken.uid)
      : reserveLocalRequest(decodedToken.uid);
    try {
      const text = await callGemini({ prompt, systemInstruction, inlineData });
      if (cacheRef) {
        await cacheRef.set({ text, createdAt: new Date().toISOString() });
      } else {
        localResponseCache.set(localCacheKey, text);
      }
      return response.status(200).json({ text, cached: false });
    } catch (error) {
      if (db) {
        await releaseDailyRequest(db, quotaRefs);
      } else {
        releaseLocalRequest(quotaRefs);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return response.status(error.status).json({ error: error.message });
    }
    console.error('AI endpoint failed:', error);
    return response.status(500).json({ error: 'AI request failed unexpectedly. Please try again.' });
  }
}
