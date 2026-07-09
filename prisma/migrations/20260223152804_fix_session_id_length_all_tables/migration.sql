-- AlterTable
ALTER TABLE "agent_events" ALTER COLUMN "session_id" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "agent_telemetry" ALTER COLUMN "session_id" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "agent_usage_records" ALTER COLUMN "session_id" SET DATA TYPE VARCHAR(50);
