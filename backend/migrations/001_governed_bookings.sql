BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE users SET tenant_id='default' WHERE tenant_id IS NULL;
ALTER TABLE users ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS booking_users_id_tenant_uidx ON users(id, tenant_id);
CREATE TABLE IF NOT EXISTS governed_bookings (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  resource_id TEXT NOT NULL,
  contact_id TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  time_zone TEXT NOT NULL,
  recurrence JSONB,
  state TEXT NOT NULL DEFAULT 'held' CHECK(state IN ('held','confirmed','cancelled','expired','completed')),
  hold_expires_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(end_at > start_at),
  UNIQUE(tenant_id,idempotency_key),
  UNIQUE(id,tenant_id),
  FOREIGN KEY(owner_id,tenant_id) REFERENCES users(id,tenant_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS governed_booking_availability_idx ON governed_bookings(tenant_id,resource_id,start_at,end_at) WHERE state IN ('held','confirmed');
CREATE TABLE IF NOT EXISTS governed_booking_events (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL,
  booking_id BIGINT NOT NULL,
  actor_id INTEGER NOT NULL, action TEXT NOT NULL,
  from_state TEXT, to_state TEXT, rationale TEXT, evidence JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(booking_id,tenant_id) REFERENCES governed_bookings(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_id,tenant_id) REFERENCES users(id,tenant_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS scheduling_outbox (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('calendar','crm_ehr','messaging','payment','identity')),
  booking_id BIGINT,
  operation TEXT NOT NULL, payload_reference TEXT NOT NULL, idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivering','delivered','failed','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(tenant_id,provider,idempotency_key),
  FOREIGN KEY(booking_id,tenant_id) REFERENCES governed_bookings(id,tenant_id) ON DELETE RESTRICT
);
CREATE OR REPLACE FUNCTION reject_booking_event_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'governed_booking_events is append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS booking_events_append_only ON governed_booking_events;
CREATE TRIGGER booking_events_append_only BEFORE UPDATE OR DELETE ON governed_booking_events FOR EACH ROW EXECUTE FUNCTION reject_booking_event_mutation();
COMMIT;
