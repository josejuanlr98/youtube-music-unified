import { describe, it, expect, vi } from 'vitest';
import { handleRequest } from '../src/httpServer.js';
import { EventEmitter } from 'node:events';

function createMockReq(method: string, url: string, body?: any): any {
  const req = new EventEmitter();
  (req as any).method = method;
  (req as any).url = url;

  if (body) {
    setTimeout(() => {
      req.emit('data', Buffer.from(JSON.stringify(body)));
      req.emit('end');
    }, 1);
  } else {
    setTimeout(() => req.emit('end'), 1);
  }

  return req;
}

function createMockRes(): any {
  const res: any = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    writeHead(code: number, headers?: Record<string, string>) {
      res.statusCode = code;
      if (headers) Object.assign(res.headers, headers);
    },
    setHeader(key: string, value: string) {
      res.headers[key] = value;
    },
    end(data?: string) {
      res.body = data ?? '';
    },
  };
  return res;
}

describe('HTTP Server', () => {
  it('returns 200 for GET /api/health', async () => {
    const req = createMockReq('GET', '/api/health');
    const res = createMockRes();
    const ctx = { castPlayer: {} as any, libraryPlayer: {} as any };

    handleRequest(req, res, ctx);

    await new Promise((r) => setTimeout(r, 50));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ready: true });
  });

  it('returns 404 for unknown routes', async () => {
    const req = createMockReq('GET', '/api/unknown');
    const res = createMockRes();
    const ctx = { castPlayer: {} as any, libraryPlayer: {} as any };

    handleRequest(req, res, ctx);

    await new Promise((r) => setTimeout(r, 50));

    expect(res.statusCode).toBe(404);
  });

  it('handles OPTIONS preflight requests', async () => {
    const req = createMockReq('OPTIONS', '/api/play');
    const res = createMockRes();
    const ctx = { castPlayer: {} as any, libraryPlayer: {} as any };

    handleRequest(req, res, ctx);

    expect(res.statusCode).toBe(204);
  });
});
