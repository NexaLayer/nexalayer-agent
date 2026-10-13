ALTER TABLE "agent_trial_claims"
  ADD COLUMN "ip_hash" VARCHAR(64),
  ADD COLUMN "device_hash" VARCHAR(64);

CREATE INDEX "agent_trial_claims_ip_hash_claimed_at_idx"
  ON "agent_trial_claims"("ip_hash", "claimed_at");

CREATE INDEX "agent_trial_claims_device_hash_claimed_at_idx"
  ON "agent_trial_claims"("device_hash", "claimed_at");
