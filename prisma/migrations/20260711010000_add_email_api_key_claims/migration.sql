CREATE TABLE "agent_email_identities" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "normalized_email" VARCHAR(200) NOT NULL,
    "email_hash" VARCHAR(64) NOT NULL,
    "first_claimed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_email_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_email_identities_agent_id_key" ON "agent_email_identities"("agent_id");
CREATE UNIQUE INDEX "agent_email_identities_email_hash_key" ON "agent_email_identities"("email_hash");

ALTER TABLE "agent_email_identities" ADD CONSTRAINT "agent_email_identities_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
