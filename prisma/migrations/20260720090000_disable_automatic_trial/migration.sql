ALTER TABLE "agent_apps"
  ALTER COLUMN "trial_balance" SET DEFAULT 0,
  ALTER COLUMN "is_trial" SET DEFAULT false;

ALTER TABLE "agent_sessions"
  ADD COLUMN "provisioning_mode" VARCHAR(20) NOT NULL DEFAULT 'purchase';

UPDATE "billing_price_rules"
SET "is_active" = false,
    "metadata" = COALESCE("metadata", '{}'::jsonb) || '{"public":false,"retired":true}'::jsonb
WHERE "code" = 'trial_credit_usd';
