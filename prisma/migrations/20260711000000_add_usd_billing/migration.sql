CREATE TABLE "agent_wallets" (
    "id" SERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "cash_balance_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "trial_balance_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "trial_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_trial_claims" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "normalized_email" VARCHAR(200) NOT NULL,
    "email_hash" VARCHAR(64) NOT NULL,
    "claimed_amount_usd" DECIMAL(12,4) NOT NULL DEFAULT 1.00,
    "claimed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_trial_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_price_rules" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "session_type" VARCHAR(20),
    "billing_unit" VARCHAR(40) NOT NULL,
    "unit_price_usd" DECIMAL(12,4) NOT NULL,
    "minimum_charge_usd" DECIMAL(12,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_price_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_ledger_entries" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "amount_usd" DECIMAL(12,4) NOT NULL,
    "cash_delta_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "trial_delta_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "cash_balance_after_usd" DECIMAL(12,4) NOT NULL,
    "trial_balance_after_usd" DECIMAL(12,4) NOT NULL,
    "session_id" VARCHAR(50),
    "backend_order_no" VARCHAR(50),
    "reservation_id" VARCHAR(50),
    "external_ref" VARCHAR(120),
    "idempotency_key" VARCHAR(64),
    "status" VARCHAR(20) NOT NULL DEFAULT 'success',
    "price_snapshot" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_reservations" (
    "id" BIGSERIAL NOT NULL,
    "reservation_id" VARCHAR(50) NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "session_id" VARCHAR(50) NOT NULL,
    "amount_usd" DECIMAL(12,4) NOT NULL,
    "cash_amount_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "trial_amount_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'reserved',
    "idempotency_key" VARCHAR(64),
    "price_snapshot" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_wallets_agent_id_key" ON "agent_wallets"("agent_id");
CREATE UNIQUE INDEX "agent_trial_claims_email_hash_key" ON "agent_trial_claims"("email_hash");
CREATE INDEX "agent_trial_claims_agent_id_idx" ON "agent_trial_claims"("agent_id");
CREATE UNIQUE INDEX "billing_price_rules_code_key" ON "billing_price_rules"("code");
CREATE INDEX "billing_price_rules_is_active_idx" ON "billing_price_rules"("is_active");
CREATE INDEX "billing_price_rules_session_type_idx" ON "billing_price_rules"("session_type");
CREATE UNIQUE INDEX "billing_ledger_entries_external_ref_key" ON "billing_ledger_entries"("external_ref");
CREATE INDEX "billing_ledger_entries_agent_id_created_at_idx" ON "billing_ledger_entries"("agent_id", "created_at" DESC);
CREATE INDEX "billing_ledger_entries_session_id_idx" ON "billing_ledger_entries"("session_id");
CREATE INDEX "billing_ledger_entries_reservation_id_idx" ON "billing_ledger_entries"("reservation_id");
CREATE INDEX "billing_ledger_entries_type_idx" ON "billing_ledger_entries"("type");
CREATE UNIQUE INDEX "billing_reservations_reservation_id_key" ON "billing_reservations"("reservation_id");
CREATE INDEX "billing_reservations_agent_id_created_at_idx" ON "billing_reservations"("agent_id", "created_at" DESC);
CREATE INDEX "billing_reservations_session_id_idx" ON "billing_reservations"("session_id");
CREATE INDEX "billing_reservations_status_idx" ON "billing_reservations"("status");

ALTER TABLE "agent_wallets" ADD CONSTRAINT "agent_wallets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_trial_claims" ADD CONSTRAINT "agent_trial_claims_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_reservations" ADD CONSTRAINT "billing_reservations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "agent_apps"
SET "trial_balance" = LEAST("trial_balance", 1.00)
WHERE "is_trial" = true;

ALTER TABLE "agent_apps"
ALTER COLUMN "trial_balance" SET DEFAULT 1.00;

INSERT INTO "billing_price_rules" ("code", "session_type", "billing_unit", "unit_price_usd", "minimum_charge_usd", "metadata")
VALUES
  ('trial_credit_usd', NULL, 'account', 1.0000, NULL, '{"public": true, "description": "One-time trial credit per email address"}'),
  ('min_recharge_usd', NULL, 'recharge', 10.0000, 10.0000, '{"public": true, "description": "Minimum USDT self-service top-up"}'),
  ('dynamic_usd_per_gb', 'dynamic', 'GB', 4.0000, NULL, '{"public": true, "description": "Dynamic network resource price per GB"}'),
  ('static_min_usd_per_month', 'static', 'month', 10.0000, 10.0000, '{"public": true, "description": "Minimum static network resource monthly price"}'),
  ('session_management_fee_usd', NULL, 'session', 0.0000, 0.0000, '{"public": true, "description": "Session management is free for now"}')
ON CONFLICT ("code") DO NOTHING;
