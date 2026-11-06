import aiHandler from '../../api/ai.js';

const MAX_BODY_BYTES = 4_500_000;

export default async function ai(request) {
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed.' },
      { status: 405, headers: { Allow: 'POST' } }
    );
  }

  const bodyBytes = await request.arrayBuffer();
  if (bodyBytes.byteLength > MAX_BODY_BYTES) {
    return Response.json(
      { error: 'Request is too large. Keep uploaded documents under 3 MB.' },
      { status: 413 }
    );
  }

  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  let statusCode = 200;
  const headers = {};
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      responseBody = value;
      return this;
    },
    setHeader(name, value) {
      headers[name] = value;
    },
  };

  await aiHandler({
    method: request.method,
    headers: { authorization: request.headers.get('authorization') || '' },
    body,
  }, response);

  return Response.json(responseBody, { status: statusCode, headers });
}

export const config = { path: '/api/ai' };
