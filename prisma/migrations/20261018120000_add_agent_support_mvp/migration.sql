-- Agent support MVP: tickets, public status, upstream cleanup retries,
-- and request_id/error_code on API logs. Additive only.

-- AlterTable
ALTER TABLE "agent_api_logs" ADD COLUMN     "error_code" VARCHAR(64),
ADD COLUMN     "request_id" VARCHAR(40);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" SERIAL NOT NULL,
    "ticket_id" VARCHAR(40) NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "severity" VARCHAR(2) NOT NULL,
    "severity_claimed" VARCHAR(2),
    "status" VARCHAR(30) NOT NULL DEFAULT 'received',
    "triage_class" VARCHAR(30) NOT NULL,
    "assignee_role" VARCHAR(20) NOT NULL,
    "route" VARCHAR(60) NOT NULL,
    "summary" VARCHAR(200) NOT NULL,
    "session_id" VARCHAR(50),
    "request_ids" JSONB NOT NULL DEFAULT '[]',
    "error_codes" JSONB NOT NULL DEFAULT '[]',
    "details" JSONB NOT NULL DEFAULT '{}',
    "known_issue_id" VARCHAR(40),
    "fingerprint" VARCHAR(64) NOT NULL,
    "idempotency_key" VARCHAR(64),
    "redactions_applied" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "first_response_by" TIMESTAMPTZ,
    "resolution" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_events" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "from_status" VARCHAR(30),
    "to_status" VARCHAR(30) NOT NULL,
    "actor" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(80) NOT NULL,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_components" (
    "id" VARCHAR(40) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'operational',
    "source" VARCHAR(10) NOT NULL DEFAULT 'auto',
    "reason" VARCHAR(300),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_incidents" (
    "id" VARCHAR(40) NOT NULL,
    "component_id" VARCHAR(40) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "impact" VARCHAR(20) NOT NULL,
    "source" VARCHAR(10) NOT NULL,
    "reason" VARCHAR(300),
    "updates" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "status_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upstream_cleanup_jobs" (
    "id" SERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "session_id" VARCHAR(50) NOT NULL,
    "backend_order_no" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "last_error" VARCHAR(300),
    "billing_stopped_at" TIMESTAMPTZ NOT NULL,
    "next_attempt_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upstream_cleanup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_id_key" ON "support_tickets"("ticket_id");

-- CreateIndex
CREATE INDEX "support_tickets_agent_id_created_at_idx" ON "support_tickets"("agent_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_fingerprint_created_at_idx" ON "support_tickets"("fingerprint", "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_agent_id_idempotency_key_key" ON "support_tickets"("agent_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "support_ticket_events_ticket_id_created_at_idx" ON "support_ticket_events"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "status_incidents_component_id_started_at_idx" ON "status_incidents"("component_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "status_incidents_resolved_at_idx" ON "status_incidents"("resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "upstream_cleanup_jobs_session_id_key" ON "upstream_cleanup_jobs"("session_id");

-- CreateIndex
CREATE INDEX "upstream_cleanup_jobs_status_next_attempt_at_idx" ON "upstream_cleanup_jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "agent_api_logs_request_id_idx" ON "agent_api_logs"("request_id");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_events" ADD CONSTRAINT "support_ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
