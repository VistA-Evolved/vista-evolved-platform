/**
 * Control Plane Admin API — Fastify server.
 *
 * Postgres-backed operator-state engine for tenant lifecycle, bootstrap,
 * provisioning, and audit. Port 4510 (see docs/reference/port-registry.md).
 *
 * Usage:
 *   node --env-file=.env src/server.mjs          # production
 *   node --watch --env-file=.env src/server.mjs   # development
 *
 * Requires: CONTROL_PLANE_PG_URL environment variable.
 */
import Fastify from 'fastify';
import { runMigrations } from './db/migrate.mjs';
import { closePool } from './db/pool.mjs';
import tenantRoutes from './routes/tenant-routes.mjs';
import bootstrapRoutes from './routes/bootstrap-routes.mjs';
import provisioningRoutes from './routes/provisioning-routes.mjs';
import auditRoutes from './routes/audit-routes.mjs';
import operatorSurfaceRoutes from './routes/operator-surface-routes.mjs';

const PORT = parseInt(process.env.PORT || '4510', 10);
const HOST = process.env.HOST || '127.0.0.1';

async function main() {
  // ---- Pre-flight: PG connection check ----
  if (!process.env.CONTROL_PLANE_PG_URL) {
    console.error('[FATAL] CONTROL_PLANE_PG_URL is not set. Cannot start without PostgreSQL.');
    process.exit(1);
  }

  // ---- Run migrations ----
  console.log('[boot] Running migrations...');
  await runMigrations();
  console.log('[boot] Migrations complete.');

  // ---- Create Fastify server ----
  const server = Fastify({ logger: true });

  // Health check
  server.get('/health', async () => ({
    ok: true,
    service: 'control-plane-admin-api',
    timestamp: new Date().toISOString(),
  }));

  // Register route plugins
  await server.register(tenantRoutes);
  await server.register(bootstrapRoutes);
  await server.register(provisioningRoutes);
  await server.register(auditRoutes);
  await server.register(operatorSurfaceRoutes);

  // ---- Graceful shutdown ----
  const shutdown = async (signal) => {
    console.log(`[shutdown] Received ${signal}, closing...`);
    await server.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // ---- Start listening ----
  await server.listen({ port: PORT, host: HOST });
  console.log(`[boot] Control Plane Admin API listening on ${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('[FATAL] Startup failed:', err);
  process.exit(1);
});
