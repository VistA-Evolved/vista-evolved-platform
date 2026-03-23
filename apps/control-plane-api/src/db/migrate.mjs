/**
 * Database migrations for the control-plane operator-state engine.
 *
 * Migrations are forward-only, idempotent (IF NOT EXISTS), and applied in order.
 * Each migration has a version number and a description.
 *
 * Run: node --env-file=.env src/db/migrate.mjs
 */
import { query, closePool } from './pool.mjs';

const migrations = [
  {
    version: 1,
    description: 'Create migration tracking table',
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (
        version   INTEGER PRIMARY KEY,
        name      TEXT NOT NULL,
        applied   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    version: 2,
    description: 'Create tenant table',
    sql: `
      CREATE TABLE IF NOT EXISTS tenant (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_name      TEXT NOT NULL,
        slug              TEXT NOT NULL UNIQUE,
        legal_market_id   TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','active','suspended','archived')),
        suspension_reason TEXT,
        created_by        TEXT NOT NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenant(status);
      CREATE INDEX IF NOT EXISTS idx_tenant_market ON tenant(legal_market_id);
    `,
  },
  {
    version: 3,
    description: 'Create tenant_lifecycle_transition table',
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_lifecycle_transition (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL REFERENCES tenant(id),
        from_status TEXT,
        to_status   TEXT NOT NULL,
        reason      TEXT,
        actor       TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_tlt_tenant ON tenant_lifecycle_transition(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tlt_created ON tenant_lifecycle_transition(created_at);
    `,
  },
  {
    version: 4,
    description: 'Create bootstrap_draft table',
    sql: `
      CREATE TABLE IF NOT EXISTS bootstrap_draft (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_name      TEXT,
        legal_market_id  TEXT,
        organization     JSONB,
        pack_selections  JSONB,
        notes            TEXT,
        status           TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','validated','approval_required',
                                           'approved','queued','superseded','cancelled')),
        created_by       TEXT NOT NULL,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_bd_status ON bootstrap_draft(status);
    `,
  },
  {
    version: 5,
    description: 'Create bootstrap_request table',
    sql: `
      CREATE TABLE IF NOT EXISTS bootstrap_request (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        draft_id         UUID REFERENCES bootstrap_draft(id),
        tenant_name      TEXT NOT NULL,
        legal_market_id  TEXT NOT NULL,
        organization     JSONB NOT NULL,
        pack_selections  JSONB NOT NULL,
        status           TEXT NOT NULL DEFAULT 'approval_required'
                         CHECK (status IN ('approval_required','approved','cancelled')),
        validation_result JSONB,
        submitted_by     TEXT NOT NULL,
        reviewed_by      TEXT,
        review_reason    TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_br_status ON bootstrap_request(status);
    `,
  },
  {
    version: 6,
    description: 'Create provisioning_run and provisioning_step tables',
    sql: `
      CREATE TABLE IF NOT EXISTS provisioning_run (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bootstrap_request_id UUID REFERENCES bootstrap_request(id),
        tenant_id           UUID REFERENCES tenant(id),
        status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','queued','running',
                                              'waiting_on_dependency','failed',
                                              'cancelled','completed')),
        created_by          TEXT NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_pr_status ON provisioning_run(status);

      CREATE TABLE IF NOT EXISTS provisioning_step (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id            UUID NOT NULL REFERENCES provisioning_run(id),
        step_name         TEXT NOT NULL,
        step_order        INTEGER NOT NULL,
        status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','running','completed','failed','skipped')),
        detail            JSONB,
        started_at        TIMESTAMPTZ,
        completed_at      TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ps_run ON provisioning_step(run_id);
    `,
  },
  {
    version: 7,
    description: 'Create audit_event table',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_event (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type  TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id   UUID,
        actor       TEXT NOT NULL,
        detail      JSONB,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ae_type ON audit_event(event_type);
      CREATE INDEX IF NOT EXISTS idx_ae_entity ON audit_event(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_ae_created ON audit_event(created_at);
    `,
  },
  {
    version: 8,
    description: 'Create outbox_event table',
    sql: `
      CREATE TABLE IF NOT EXISTS outbox_event (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type  TEXT NOT NULL,
        payload     JSONB NOT NULL,
        published   BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_oe_unpublished ON outbox_event(published) WHERE NOT published;
    `,
  },
  {
    version: 9,
    description: 'Operator invitations, alerts, usage metering, commercial stubs, feature flags',
    sql: `
      CREATE TABLE IF NOT EXISTS operator_invitation (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID REFERENCES tenant(id),
        email        TEXT NOT NULL,
        token_hash   TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','revoked','expired')),
        invited_by   TEXT NOT NULL,
        expires_at   TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_oi_tenant ON operator_invitation(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_oi_status ON operator_invitation(status);

      CREATE TABLE IF NOT EXISTS operator_alert (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID REFERENCES tenant(id),
        severity         TEXT NOT NULL DEFAULT 'info'
                         CHECK (severity IN ('info','warning','error','critical')),
        title            TEXT NOT NULL,
        body             TEXT,
        acknowledged_at  TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_oa_severity ON operator_alert(severity);
      CREATE INDEX IF NOT EXISTS idx_oa_created ON operator_alert(created_at);

      CREATE TABLE IF NOT EXISTS usage_meter_event (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID REFERENCES tenant(id),
        metric_name  TEXT NOT NULL,
        quantity     NUMERIC NOT NULL DEFAULT 1,
        detail       JSONB,
        recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ume_tenant ON usage_meter_event(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_ume_metric ON usage_meter_event(metric_name);

      CREATE TABLE IF NOT EXISTS commercial_entitlement (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID NOT NULL REFERENCES tenant(id),
        sku              TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'stub'
                         CHECK (status IN ('stub','active','suspended')),
        billing_provider TEXT NOT NULL DEFAULT 'unconfigured',
        external_ref     TEXT,
        meta             JSONB,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ce_tenant ON commercial_entitlement(tenant_id);

      CREATE TABLE IF NOT EXISTS environment_feature_flag (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flag_key     TEXT NOT NULL,
        environment  TEXT NOT NULL DEFAULT 'default',
        enabled      BOOLEAN NOT NULL DEFAULT false,
        meta         JSONB,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(flag_key, environment)
      );
    `,
  },
  {
    version: 10,
    description: 'Schema hardening: cascades, uniqueness, updated_at triggers',
    sql: `
      -- 1. updated_at auto-maintenance trigger function
      CREATE OR REPLACE FUNCTION ve_set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = now(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenant_updated_at') THEN
          CREATE TRIGGER trg_tenant_updated_at BEFORE UPDATE ON tenant
            FOR EACH ROW EXECUTE FUNCTION ve_set_updated_at();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bootstrap_draft_updated_at') THEN
          CREATE TRIGGER trg_bootstrap_draft_updated_at BEFORE UPDATE ON bootstrap_draft
            FOR EACH ROW EXECUTE FUNCTION ve_set_updated_at();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bootstrap_request_updated_at') THEN
          CREATE TRIGGER trg_bootstrap_request_updated_at BEFORE UPDATE ON bootstrap_request
            FOR EACH ROW EXECUTE FUNCTION ve_set_updated_at();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_provisioning_run_updated_at') THEN
          CREATE TRIGGER trg_provisioning_run_updated_at BEFORE UPDATE ON provisioning_run
            FOR EACH ROW EXECUTE FUNCTION ve_set_updated_at();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_commercial_entitlement_updated_at') THEN
          CREATE TRIGGER trg_commercial_entitlement_updated_at BEFORE UPDATE ON commercial_entitlement
            FOR EACH ROW EXECUTE FUNCTION ve_set_updated_at();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_feature_flag_updated_at') THEN
          CREATE TRIGGER trg_feature_flag_updated_at BEFORE UPDATE ON environment_feature_flag
            FOR EACH ROW EXECUTE FUNCTION ve_set_updated_at();
        END IF;
      END $$;

      -- 2. Prevent duplicate entitlements per tenant+SKU
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ce_tenant_sku
        ON commercial_entitlement(tenant_id, sku);

      -- 3. Prevent duplicate pending invitations per tenant+email
      CREATE UNIQUE INDEX IF NOT EXISTS idx_oi_pending_email
        ON operator_invitation(tenant_id, email) WHERE status = 'pending';

      -- 4. CASCADE child rows when parent tenant is deleted
      ALTER TABLE tenant_lifecycle_transition
        DROP CONSTRAINT IF EXISTS tenant_lifecycle_transition_tenant_id_fkey,
        ADD CONSTRAINT tenant_lifecycle_transition_tenant_id_fkey
          FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

      -- 5. CASCADE provisioning steps when run is deleted
      ALTER TABLE provisioning_step
        DROP CONSTRAINT IF EXISTS provisioning_step_run_id_fkey,
        ADD CONSTRAINT provisioning_step_run_id_fkey
          FOREIGN KEY (run_id) REFERENCES provisioning_run(id) ON DELETE CASCADE;

      -- 6. CASCADE operator records when tenant is deleted
      ALTER TABLE operator_invitation
        DROP CONSTRAINT IF EXISTS operator_invitation_tenant_id_fkey,
        ADD CONSTRAINT operator_invitation_tenant_id_fkey
          FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

      ALTER TABLE operator_alert
        DROP CONSTRAINT IF EXISTS operator_alert_tenant_id_fkey,
        ADD CONSTRAINT operator_alert_tenant_id_fkey
          FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

      ALTER TABLE usage_meter_event
        DROP CONSTRAINT IF EXISTS usage_meter_event_tenant_id_fkey,
        ADD CONSTRAINT usage_meter_event_tenant_id_fkey
          FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;
    `,
  },
];

/**
 * Apply all pending migrations.
 * @returns {Promise<{ applied: number, total: number }>}
 */
export async function runMigrations() {
  // Ensure migration table exists first
  await query(migrations[0].sql);

  const { rows } = await query('SELECT version FROM _migrations ORDER BY version');
  const applied = new Set(rows.map(r => r.version));

  let count = 0;
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    console.log(`  Applying migration v${m.version}: ${m.description}`);
    await query(m.sql);
    await query(
      'INSERT INTO _migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [m.version, m.description]
    );
    count++;
  }
  return { applied: count, total: migrations.length };
}

// Direct invocation: node --env-file=.env src/db/migrate.mjs
const isDirectRun = process.argv[1]?.endsWith('migrate.mjs');
if (isDirectRun) {
  try {
    console.log('Running control-plane migrations...');
    const result = await runMigrations();
    console.log(`Done. Applied ${result.applied} of ${result.total} migrations.`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}
