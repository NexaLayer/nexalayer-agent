CREATE TABLE "agent_email_login_codes" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "code_hash" VARCHAR(256) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_email_login_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_email_login_codes_agent_id_created_at_idx"
ON "agent_email_login_codes"("agent_id", "created_at" DESC);

CREATE INDEX "agent_email_login_codes_expires_at_idx"
ON "agent_email_login_codes"("expires_at");

ALTER TABLE "agent_email_login_codes"
ADD CONSTRAINT "agent_email_login_codes_agent_id_fkey"
FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
