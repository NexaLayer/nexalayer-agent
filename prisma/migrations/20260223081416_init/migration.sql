-- CreateTable
CREATE TABLE "agent_apps" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "api_key" VARCHAR(64) NOT NULL,
    "api_secret_hash" VARCHAR(256) NOT NULL,
    "backend_user_id" INTEGER,
    "backend_username" VARCHAR(50),
    "backend_password_enc" VARCHAR(256),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "balance_cache" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "trial_balance" DECIMAL(12,2) NOT NULL DEFAULT 5.00,
    "is_trial" BOOLEAN NOT NULL DEFAULT true,
    "permissions" JSONB NOT NULL DEFAULT '["proxy:read","proxy:write","session:manage","billing:read"]',
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 60,
    "rate_limit_per_day" INTEGER NOT NULL DEFAULT 10000,
    "max_active_sessions" INTEGER NOT NULL DEFAULT 100,
    "auth_mode" VARCHAR(20) NOT NULL DEFAULT 'api_key_only',
    "contact_email" VARCHAR(200),
    "webhook_url" VARCHAR(500),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "last_active_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" SERIAL NOT NULL,
    "session_id" VARCHAR(36) NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "session_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'creating',
    "proxy_host" VARCHAR(200),
    "proxy_port" INTEGER,
    "proxy_username" VARCHAR(100),
    "proxy_password_enc" VARCHAR(256),
    "proxy_protocol" VARCHAR(10) NOT NULL DEFAULT 'socks5',
    "country_code" VARCHAR(10),
    "city_code" VARCHAR(20),
    "isp_type" VARCHAR(20),
    "identity_id" VARCHAR(36),
    "identity_pool" VARCHAR(50),
    "rotation_mode" VARCHAR(20) NOT NULL DEFAULT 'fixed',
    "rotation_interval_sec" INTEGER NOT NULL DEFAULT 0,
    "last_rotated_at" TIMESTAMPTZ,
    "last_rotate_reason" VARCHAR(50),
    "backend_order_no" VARCHAR(50),
    "backend_product_no" VARCHAR(50),
    "backend_instance_id" VARCHAR(50),
    "risk_level" VARCHAR(10) NOT NULL DEFAULT 'low',
    "health_score" INTEGER NOT NULL DEFAULT 100,
    "success_rate" DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "last_error_type" VARCHAR(50),
    "total_events" INTEGER NOT NULL DEFAULT 0,
    "bytes_used" BIGINT NOT NULL DEFAULT 0,
    "requests_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_api_logs" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" INTEGER,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "status_code" INTEGER,
    "latency_ms" INTEGER,
    "request_body" JSONB,
    "response_summary" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "idempotency_key" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_idempotency_keys" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "request_path" VARCHAR(500) NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_usage_records" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "session_id" VARCHAR(36),
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(20),
    "cost_amount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_events" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" INTEGER,
    "session_id" VARCHAR(36),
    "event_type" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_telemetry" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "session_id" VARCHAR(36) NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "status_code" INTEGER,
    "target_host" VARCHAR(200),
    "latency_ms" INTEGER,
    "error_message" VARCHAR(500),
    "risk_level" VARCHAR(10),
    "block_probability" DECIMAL(5,4),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_apps_api_key_key" ON "agent_apps"("api_key");

-- CreateIndex
CREATE INDEX "agent_apps_status_idx" ON "agent_apps"("status");

-- CreateIndex
CREATE INDEX "agent_apps_backend_user_id_idx" ON "agent_apps"("backend_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_sessions_session_id_key" ON "agent_sessions"("session_id");

-- CreateIndex
CREATE INDEX "agent_sessions_agent_id_idx" ON "agent_sessions"("agent_id");

-- CreateIndex
CREATE INDEX "agent_sessions_status_idx" ON "agent_sessions"("status");

-- CreateIndex
CREATE INDEX "agent_sessions_expires_at_idx" ON "agent_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "agent_sessions_identity_id_idx" ON "agent_sessions"("identity_id");

-- CreateIndex
CREATE INDEX "agent_sessions_risk_level_idx" ON "agent_sessions"("risk_level");

-- CreateIndex
CREATE INDEX "agent_api_logs_agent_id_created_at_idx" ON "agent_api_logs"("agent_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_api_logs_created_at_idx" ON "agent_api_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_idempotency_keys_expires_at_idx" ON "agent_idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_idempotency_keys_agent_id_idempotency_key_key" ON "agent_idempotency_keys"("agent_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "agent_usage_records_agent_id_created_at_idx" ON "agent_usage_records"("agent_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_usage_records_session_id_idx" ON "agent_usage_records"("session_id");

-- CreateIndex
CREATE INDEX "agent_events_agent_id_created_at_idx" ON "agent_events"("agent_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_events_event_type_idx" ON "agent_events"("event_type");

-- CreateIndex
CREATE INDEX "agent_telemetry_session_id_created_at_idx" ON "agent_telemetry"("session_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_telemetry_agent_id_created_at_idx" ON "agent_telemetry"("agent_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_telemetry_event_type_idx" ON "agent_telemetry"("event_type");

-- CreateIndex
CREATE INDEX "agent_telemetry_risk_level_created_at_idx" ON "agent_telemetry"("risk_level", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_api_logs" ADD CONSTRAINT "agent_api_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_idempotency_keys" ADD CONSTRAINT "agent_idempotency_keys_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_usage_records" ADD CONSTRAINT "agent_usage_records_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_telemetry" ADD CONSTRAINT "agent_telemetry_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
