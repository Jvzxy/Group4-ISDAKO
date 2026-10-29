// Tiny HTTP helpers: router and JSON in/out. Built on node:http so the server needs no web framework.

import type { IncomingMessage, ServerResponse } from 'node:http';

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  ip: string;
}

export type Handler = (ctx: Ctx) => void | Promise<void>;

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

export function hasJsonContentType(req: IncomingMessage): boolean {
  return (req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json');
}

/** Reads a small JSON object body. */
export async function readJson(req: IncomingMessage, limitBytes = 16 * 1024): Promise<Record<string, unknown>> {
  if (!hasJsonContentType(req)) throw new HttpError(415, 'Requests must be sent as JSON.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > limitBytes) throw new HttpError(413, 'The request is too large.');
    chunks.push(buf);
  }
  if (size === 0) return {};
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // fall through to the error below
  }
  throw new HttpError(400, 'The request could not be read.');
}

interface Route {
  method: string;
  re: RegExp;
  keys: string[];
  handler: Handler;
  staff: boolean;
}

export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class Router {
  private routes: Route[] = [];

  /** `:name` segments become params. `staff: true` requires a staff session. */
  add(method: string, pattern: string, handler: Handler, opts: { staff?: boolean } = {}): void {
    const keys: string[] = [];
    const parts = pattern.split('/').map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '([^/]+)';
      }
      return escapeRe(seg);
    });
    this.routes.push({
      method,
      re: new RegExp(`^${parts.join('/')}$`),
      keys,
      handler,
      staff: Boolean(opts.staff),
    });
  }

  /** Returns the match, 'method' when the path exists with another method, or null. */
  match(method: string, pathname: string): RouteMatch | 'method' | null {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => {
        try {
          params[key] = decodeURIComponent(m[i + 1] ?? '');
        } catch {
          params[key] = '';
        }
      });
      return { route, params };
    }
    return pathMatched ? 'method' : null;
  }
}
