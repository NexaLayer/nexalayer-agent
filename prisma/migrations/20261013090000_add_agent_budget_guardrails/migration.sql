CREATE TABLE "agent_budget_policies" (
  "id" SERIAL NOT NULL,
  "agent_id" INTEGER NOT NULL,
  "key_limit_usd" DECIMAL(12,2),
  "daily_limit_usd" DECIMAL(12,2),
  "pause_on_exceed" BOOLEAN NOT NULL DEFAULT TRUE,
  "alert_thresholds" JSONB NOT NULL DEFAULT '[50,80,100]',
  "paused_at" TIMESTAMPTZ,
  "pause_reason" VARCHAR(100),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_budget_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_budget_policies_agent_id_key" UNIQUE ("agent_id"),
  CONSTRAINT "agent_budget_policies_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "agent_sessions"
  ADD COLUMN "estimated_charge_usd" DECIMAL(12,2) NOT NULL DEFAULT 0;

