/**
 * Terminal Proof Server
 *
 * Minimal Fastify server that:
 *   1. Serves a static HTML page with xterm.js
 *   2. Provides /ws/terminal WebSocket-to-SSH bridge
 *   3. Provides /terminal/health SSH probe
 *
 * Target: local-vista-utf8 distro container (SSH on port 2226, UTF-8 lane)
 * Lane truth: VE-DISTRO-ADR-0003 designates UTF-8 as primary planned operator lane.
 * Default fallback port 2225 retained for M-mode rollback lane.
 */

import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { Client as SSHClient } from 'ssh2';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SSH_HOST = process.env.VISTA_SSH_HOST || '127.0.0.1';
const SSH_PORT = parseInt(process.env.VISTA_SSH_PORT || '2225', 10);
const SSH_USER = process.env.VISTA_SSH_USER || 'vista';
const SSH_PASS = process.env.VISTA_SSH_PASSWORD;
if (!SSH_PASS) {
  console.error('[FATAL] VISTA_SSH_PASSWORD is not set. Set it in .env or environment variables.');
  process.exit(1);
}
const PORT = parseInt(process.env.PORT || '4400', 10);

const activeSessions = new Map();

const server = Fastify({ logger: true });

await server.register(websocket);
await server.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
  prefix: '/',
});

// ── WebSocket-to-SSH bridge ─────────────────────────────────────────────────
server.get('/ws/terminal', { websocket: true }, (socket, request) => {
  const sessionId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  server.log.info({ sessionId, sshHost: SSH_HOST, sshPort: SSH_PORT }, 'Terminal session starting');

  activeSessions.set(sessionId, {
    sessionId,
    connectedAt: new Date().toISOString(),
  });

  const ssh = new SSHClient();
  let sshConnected = false;
  let cleanedUp = false;

  ssh.on('ready', () => {
    sshConnected = true;
    server.log.info({ sessionId }, 'SSH ready');

    ssh.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, stream) => {
      if (err) {
        socket.send(JSON.stringify({ type: 'error', message: 'Failed to open shell' }));
        socket.close();
        cleanup('shell-error');
        return;
      }

      socket.send(JSON.stringify({ type: 'connected', sessionId }));

      // SSH stdout -> browser
      stream.on('data', (data) => {
        if (socket.readyState === 1) socket.send(data);
      });
      stream.stderr.on('data', (data) => {
        if (socket.readyState === 1) socket.send(data);
      });

      // Browser keystrokes -> SSH
      socket.on('message', (msg) => {
        if (!sshConnected) return;
        const text = typeof msg === 'string' ? msg : Buffer.isBuffer(msg) ? msg.toString('utf8') : null;

        if (text) {
          try {
            const parsed = JSON.parse(text);
            if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
              stream.setWindow(parsed.rows, parsed.cols, 0, 0);
              return;
            }
            if (parsed.type === 'ping') {
              socket.send(JSON.stringify({ type: 'pong' }));
              return;
            }
          } catch {
            // Not JSON — raw terminal input
          }
        }
        stream.write(msg);
      });

      stream.on('close', () => {
        server.log.info({ sessionId }, 'SSH stream closed');
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'disconnected', reason: 'SSH stream closed' }));
          socket.close();
        }
        cleanup('ssh-stream-close');
      });
    });
  });

  ssh.on('error', (err) => {
    server.log.error({ sessionId, error: err.message }, 'SSH error');
    if (socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'error', message: `SSH error: ${err.message}` }));
      socket.close();
    }
    cleanup('ssh-error');
  });

  ssh.on('close', () => {
    server.log.info({ sessionId }, 'SSH closed');
    if (socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'disconnected', reason: 'SSH closed' }));
      socket.close();
    }
    cleanup('ssh-close');
  });

  socket.on('close', () => {
    server.log.info({ sessionId }, 'WebSocket closed');
    cleanup('ws-close');
  });

  socket.on('error', (err) => {
    server.log.error({ sessionId, error: err.message }, 'WebSocket error');
    cleanup('ws-error');
  });

  function cleanup(reason) {
    if (cleanedUp) return;
    cleanedUp = true;
    sshConnected = false;
    activeSessions.delete(sessionId);
    try { ssh.end(); } catch { /* ignore */ }
    server.log.info({ sessionId, reason }, 'Session cleaned up');
  }

  ssh.connect({
    host: SSH_HOST,
    port: SSH_PORT,
    username: SSH_USER,
    password: SSH_PASS,
    keepaliveInterval: 30000,
    readyTimeout: 10000,
  });
});

// ── Health check ────────────────────────────────────────────────────────────
server.get('/terminal/health', async () => {
  return new Promise((resolve) => {
    const ssh = new SSHClient();
    const timeout = setTimeout(() => {
      try { ssh.end(); } catch { /* */ }
      resolve({ ok: false, ssh: { host: SSH_HOST, port: SSH_PORT, status: 'timeout' }, activeSessions: activeSessions.size });
    }, 5000);

    ssh.on('ready', () => {
      clearTimeout(timeout);
      ssh.end();
      resolve({ ok: true, ssh: { host: SSH_HOST, port: SSH_PORT, status: 'connected' }, activeSessions: activeSessions.size });
    });

    ssh.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, ssh: { host: SSH_HOST, port: SSH_PORT, status: 'error', error: err.message }, activeSessions: activeSessions.size });
    });

    ssh.connect({ host: SSH_HOST, port: SSH_PORT, username: SSH_USER, password: SSH_PASS, readyTimeout: 5000 });
  });
});

// ── Sessions list ───────────────────────────────────────────────────────────
server.get('/terminal/sessions', async () => {
  return { ok: true, sessions: Array.from(activeSessions.values()), count: activeSessions.size };
});

// ── Start ───────────────────────────────────────────────────────────────────
try {
  await server.listen({ port: PORT, host: '0.0.0.0' });
  server.log.info(`Terminal proof server on http://localhost:${PORT}`);
  server.log.info(`SSH target: ${SSH_USER}@${SSH_HOST}:${SSH_PORT}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
