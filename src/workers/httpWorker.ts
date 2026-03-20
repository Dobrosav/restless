/* eslint-disable no-restricted-globals */
const ctx = self as unknown as Worker;

interface RequestMessage {
  id: number;
  request: any;
  environment: any;
}

interface CancelMessage {
  id: number;
}

const pendingRequests = new Map<number, { abortController: AbortController; resolve: (value: any) => void; reject: (error: any) => void }>();

function interpolateEnvVariables(text: string, environment: any): string {
  if (!text || !environment) return text;
  return text.replace(/\{\{([^}]+)\}\}|\{([^}]+)\}/g, (match, keyDouble, keySingle) => {
    const key = keyDouble || keySingle;
    if (environment.variables) {
      const v = environment.variables.find((v: any) => v.enabled && v.key === key.trim());
      if (v) return v.value;
    }
    return match;
  });
}

function buildAuthHeaders(request: any, environment: any): Record<string, string> {
  const headers: Record<string, string> = {};
  if (request.auth?.type === 'basic' && request.auth.basic) {
    const encoded = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
    headers['Authorization'] = `Basic ${encoded}`;
  } else if (request.auth?.type === 'bearer' && request.auth.bearer) {
    headers['Authorization'] = `Bearer ${interpolateEnvVariables(request.auth.bearer.token, environment)}`;
  } else if (request.auth?.type === 'api-key' && request.auth.apiKey) {
    if (request.auth.apiKey.in === 'header') {
      headers[interpolateEnvVariables(request.auth.apiKey.key, environment)] = interpolateEnvVariables(request.auth.apiKey.value, environment);
    }
  }
  return headers;
}

function buildHeaders(request: any, environment: any): Record<string, string> {
  const headers: Record<string, string> = {};
  if (Array.isArray(request.headers)) {
    request.headers.filter((h: any) => h.enabled && h.key).forEach((h: any) => {
      headers[interpolateEnvVariables(h.key, environment)] = interpolateEnvVariables(h.value, environment);
    });
  }
  const authHeaders = buildAuthHeaders(request, environment);
  Object.assign(headers, authHeaders);
  if (request.body?.type === 'json' && request.body.content) {
    headers['Content-Type'] = 'application/json';
  } else if (request.body?.type === 'x-www-form-urlencoded') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (request.body?.type === 'graphql') {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function sendHttpRequest(request: any, environment: any, abortSignal: AbortSignal): Promise<any> {
  const startTime = performance.now();
  let url = interpolateEnvVariables(request.url, environment) || '';
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'http://' + url;
  }
  
  const params: Record<string, string> = {};
  if (Array.isArray(request.params)) {
    request.params.filter((p: any) => p.enabled && p.key).forEach((p: any) => {
      params[interpolateEnvVariables(p.key, environment)] = interpolateEnvVariables(p.value, environment);
    });
  }
  if (request.auth?.type === 'api-key' && request.auth?.apiKey?.in === 'query') {
    params[interpolateEnvVariables(request.auth.apiKey.key, environment)] = interpolateEnvVariables(request.auth.apiKey.value, environment);
  }

  let data: any = undefined;
  if (request.body?.type === 'json' && request.body.content) {
    try {
      data = JSON.parse(interpolateEnvVariables(request.body.content, environment));
    } catch (e) {
      data = interpolateEnvVariables(request.body.content, environment);
    }
  } else if (request.body?.type === 'text' && request.body.content) {
    data = interpolateEnvVariables(request.body.content, environment);
  } else if (request.body?.type === 'x-www-form-urlencoded' && request.body.content) {
    const parsedBody = interpolateEnvVariables(request.body.content, environment);
    try {
      const obj = JSON.parse(parsedBody);
      const formData = new URLSearchParams();
      Object.entries(obj).forEach(([key, value]) => formData.append(key, String(value)));
      data = formData.toString();
    } catch (e) {
      data = parsedBody;
    }
  } else if (request.body?.type === 'graphql' && request.body.graphql) {
    const query = interpolateEnvVariables(request.body.graphql.query, environment);
    let variables = {};
    try {
      variables = JSON.parse(interpolateEnvVariables(request.body.graphql.variables, environment));
    } catch (e) {}
    data = { query, variables };
  }

  const fetchOptions: RequestInit = {
    method: request.method || 'GET',
    headers: buildHeaders(request, environment),
    signal: abortSignal,
  };

  if (data !== undefined && !['GET', 'HEAD'].includes(request.method)) {
    if (typeof data === 'object' && !(data instanceof URLSearchParams)) {
      data = JSON.stringify(data);
    }
    fetchOptions.body = data;
  }

  if (Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params);
    url += (url.includes('?') ? '&' : '?') + searchParams.toString();
  }

  const response = await fetch(url, fetchOptions);
  const endTime = performance.now();
  
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  
  let responseBody: string;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const jsonData = await response.json();
    responseBody = JSON.stringify(jsonData, null, 2);
  } else {
    responseBody = await response.text();
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: responseBody,
    time: Math.round(endTime - startTime),
    size: new Blob([responseBody]).size,
    type: 'http',
  };
}

ctx.onmessage = async (e: MessageEvent) => {
  const { type, id, request, environment } = e.data;

  if (type === 'cancel') {
    const pending = pendingRequests.get(id);
    if (pending) {
      pending.abortController.abort();
      pendingRequests.delete(id);
      pending.resolve({
        status: 0,
        statusText: 'Cancelled',
        headers: {},
        body: 'Request cancelled by user',
        time: 0,
        size: 0,
        type: 'http',
        cancelled: true,
      });
    }
    return;
  }

  if (type === 'send') {
    const abortController = new AbortController();
    
    const promise = new Promise<any>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new Error('Request timeout'));
      }, 30000);

      sendHttpRequest(request, environment, abortController.signal)
        .then((response) => {
          clearTimeout(timeoutId);
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            resolve({
              status: 0,
              statusText: 'Cancelled',
              headers: {},
              body: 'Request cancelled by user',
              time: 0,
              size: 0,
              type: 'http',
              cancelled: true,
            });
          } else {
            reject(error);
          }
        });
    });

    pendingRequests.set(id, { abortController, resolve: promise.then.bind(promise), reject: promise.catch.bind(promise) });

    try {
      const response = await promise;
      pendingRequests.delete(id);
      ctx.postMessage({ id, response, success: true });
    } catch (error: any) {
      pendingRequests.delete(id);
      ctx.postMessage({
        id,
        response: {
          status: 0,
          statusText: error.message || 'Error',
          headers: {},
          body: error.message || 'Request failed',
          time: 0,
          size: 0,
          type: 'http',
          error: true,
        },
        success: true,
      });
    }
  }
};
