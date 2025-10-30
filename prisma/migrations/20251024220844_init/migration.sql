-- CreateIndex
CREATE INDEX "Message_chat_room_id_created_at_idx" ON "public"."Message"("chat_room_id", "created_at");

-- CreateIndex
CREATE INDEX "Message_sender_id_created_at_idx" ON "public"."Message"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "MessageStatus_recipient_id_status_idx" ON "public"."MessageStatus"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "Notification_recipient_id_read_idx" ON "public"."Notification"("recipient_id", "read");

-- CreateIndex
CREATE INDEX "Notification_recipient_id_created_at_idx" ON "public"."Notification"("recipient_id", "created_at");
