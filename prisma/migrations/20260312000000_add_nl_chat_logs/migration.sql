-- CreateTable
CREATE TABLE "nl_chat_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "conversation_id" VARCHAR(50) NOT NULL,
    "user_message" TEXT NOT NULL,
    "assistant_message" TEXT NOT NULL,
    "intent" VARCHAR(80),
    "confidence" DECIMAL(3,2),
    "slots" JSONB NOT NULL DEFAULT '{}',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_agent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nl_chat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nl_chat_logs_user_id_created_at_idx"
  ON "nl_chat_logs"("user_id", "created_at" DESC);

CREATE INDEX "nl_chat_logs_created_at_idx"
  ON "nl_chat_logs"("created_at" DESC);

CREATE INDEX "nl_chat_logs_intent_idx"
  ON "nl_chat_logs"("intent");

CREATE INDEX "nl_chat_logs_username_idx"
  ON "nl_chat_logs"("username");
