import { ApiRequest, ResponseData } from '../types';

const WORKER_CODE = `
/* eslint-disable no-restricted-globals */
const ctx = self;

const pendingRequests = new Map();

function interpolateEnvVariables(text, environment) {
  if (!text || !environment) return text;
  return text.replace(/\\{\\{([^}]+)\\}\\}\\{\\{([^}]+)\\}\\}/g, (match, keyDouble, keySingle) => {
    const key = keyDouble || keySingle;
    if (environment.variables) {
      const v = environment.variables.find((v) => v.enabled && v.key === key.trim());
      if (v) return v.value;
    }
    return match;
  });
}

function buildAuthHeaders(request, environment) {
  const headers = {};
  if (request.auth?.type === 'basic' && request.auth.basic) {
    const encoded = btoa(request.auth.basic.username + ':' + request.auth.basic.password);
    headers['Authorization'] = 'Basic ' + encoded;
  } else if (request.auth?.type === 'bearer' && request.auth.bearer) {
    headers['Authorization'] = 'Bearer ' + interpolateEnvVariables(request.auth.bearer.token, environment);
  } else if (request.auth?.type === 'api-key' && request.auth.apiKey) {
    if (request.auth.apiKey.in === 'header') {
      headers[interpolateEnvVariables(request.auth.apiKey.key, environment)] = interpolateEnvVariables(request.auth.apiKey.value, environment);
    }
  }
  return headers;
}

function buildHeaders(request, environment) {
  const headers = {};
  if (Array.isArray(request.headers)) {
    request.headers.filter((h) => h.enabled && h.key).forEach((h) => {
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

async function sendHttpRequest(request, environment, abortSignal) {
  const startTime = performance.now();
  let url = interpolateEnvVariables(request.url, environment) || '';
  if (url && !/^https?:\\/\\//i.test(url)) {
    url = 'http://' + url;
  }
  
  const params = {};
  if (Array.isArray(request.params)) {
    request.params.filter((p) => p.enabled && p.key).forEach((p) => {
      params[interpolateEnvVariables(p.key, environment)] = interpolateEnvVariables(p.value, environment);
    });
  }
  if (request.auth?.type === 'api-key' && request.auth?.apiKey?.in === 'query') {
    params[interpolateEnvVariables(request.auth.apiKey.key, environment)] = interpolateEnvVariables(request.auth.apiKey.value, environment);
  }

  let data = undefined;
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

  const fetchOptions = {
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
  
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  
  let responseBody;
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

ctx.onmessage = async (e) => {
  const { type, id, request, environment } = e.data;

  if (type === 'cancel') {
    pendingRequests.forEach((pending, pendingId) => {
      if (pendingId === id || id === undefined) {
        pending.abortController.abort();
        pendingRequests.delete(pendingId);
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
    });
    if (id === undefined) pendingRequests.clear();
    return;
  }

  if (type === 'send') {
    const abortController = new AbortController();
    
    const promise = new Promise((resolve, reject) => {
      pendingRequests.set(id, { abortController, resolve, reject });

      const timeoutId = setTimeout(() => {
        abortController.abort();
        const pending = pendingRequests.get(id);
        if (pending) {
          pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);

      sendHttpRequest(request, environment, abortController.signal)
        .then((response) => {
          clearTimeout(timeoutId);
          const pending = pendingRequests.get(id);
          if (pending) {
            pendingRequests.delete(id);
            pending.resolve(response);
          }
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          const pending = pendingRequests.get(id);
          if (pending) {
            pendingRequests.delete(id);
            if (error.name === 'AbortError') {
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
            } else {
              pending.reject(error);
            }
          }
        });
    });
  }
};
`;

let requestIdCounter = 0;
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
  }
  return worker;
}

export function createHttpClient() {
  const pendingRequests = new Map<number, { resolve: (r: ResponseData) => void; reject: (e: Error) => void }>();

  const worker = getWorker();
  
  worker.onmessage = (e) => {
    const { id, response, success } = e.data;
    const handlers = pendingRequests.get(id);
    if (handlers) {
      pendingRequests.delete(id);
      if (success) {
        handlers.resolve(response);
      } else {
        handlers.reject(new Error(response.body));
      }
    }
  };

  worker.onerror = (e) => {
    console.error('Worker error:', e);
  };

  return {
    sendRequest(request: ApiRequest, environment: any): Promise<ResponseData> {
      return new Promise((resolve, reject) => {
        const id = ++requestIdCounter;
        pendingRequests.set(id, { resolve, reject });
        worker!.postMessage({ type: 'send', id, request, environment });
      });
    },

    cancelRequest(requestId?: number): void {
      if (requestId !== undefined) {
        const handlers = pendingRequests.get(requestId);
        if (handlers) {
          worker!.postMessage({ type: 'cancel', id: requestId });
          pendingRequests.delete(requestId);
        }
      } else {
        pendingRequests.forEach((_, id) => {
          worker!.postMessage({ type: 'cancel', id });
        });
        pendingRequests.clear();
      }
    },
  };
}
