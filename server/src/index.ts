// Entry point: node:http server for the ISDAKO app.

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import { TRUST_PROXY, isStaff, usingDefaultPin } from './auth';
import { closeDb, dataDir } from './db';
import { HttpError, hasJsonContentType, sendJson } from './http';
import { buildRouter } from './routes';
import { smsConfigProblems, smsProvider } from './sms';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

if (usingDefaultPin) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Not starting: set STAFF_PIN in production (do not use the default 1234).');
    process.exit(1);
  }
  console.warn('! STAFF_PIN is not set, using the default "1234". Set it before real use.');
}

const smsProblems = smsConfigProblems();
if (smsProblems.length > 0) {
  for (const problem of smsProblems) console.error(`Not starting: ${problem}`);
  process.exit(1);
}

const router = buildRouter();

function clientIp(req: IncomingMessage): string {
  if (TRUST_PROXY) {
    const forwarded = req.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function sendError(res: ServerResponse, err: unknown): void {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : 'Something went wrong on the server. Please try again.';
  if (status >= 500) console.error(err);
  if (res.headersSent) {
    res.end();
    return;
  }
  sendJson(res, status, { error: message });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');
    const match = router.match(method, url.pathname);

    if (match === null) throw new HttpError(404, 'Not found.');
    if (match === 'method') throw new HttpError(405, 'That method is not allowed here.');

    if (method !== 'GET' && !hasJsonContentType(req)) {
      throw new HttpError(415, 'Requests must be sent as JSON.');
    }
    if (match.route.staff && !isStaff(req)) {
      throw new HttpError(401, 'Staff sign-in is required.');
    }

    await match.route.handler({ req, res, url, params: match.params, ip: clientIp(req) });
  } catch (err) {
    sendError(res, err);
  }
}

const server = http.createServer((req, res) => {
  void handle(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`ISDAKO server is running (data: ${dataDir})`);
  console.log(`  This computer: http://localhost:${PORT}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  For the phone (same Wi-Fi): http://${a.address}:${PORT}`);
    }
  }
  console.log(`  SMS alerts: ${smsProvider}${smsProvider === 'console' ? ' (test mode: messages are printed here, not sent)' : ''}`);
});

function shutdown(): void {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
