-- CreateIndex
CREATE INDEX "DogEvent_petId_idx" ON "DogEvent"("petId");

-- CreateIndex
CREATE INDEX "DogEvent_createdAt_idx" ON "DogEvent"("createdAt");

-- CreateIndex
CREATE INDEX "DogEvent_eventType_idx" ON "DogEvent"("eventType");

-- CreateIndex
CREATE INDEX "DogTask_userId_idx" ON "DogTask"("userId");

-- CreateIndex
CREATE INDEX "DogTask_petId_idx" ON "DogTask"("petId");

-- CreateIndex
CREATE INDEX "DogTask_status_idx" ON "DogTask"("status");

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE INDEX "Like_userId_idx" ON "Like"("userId");

-- CreateIndex
CREATE INDEX "Like_targetId_targetType_idx" ON "Like"("targetId", "targetType");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_senderId_idx" ON "Notification"("senderId");

-- CreateIndex
CREATE INDEX "Pet_ownerId_idx" ON "Pet"("ownerId");

-- CreateIndex
CREATE INDEX "SocialPost_userId_idx" ON "SocialPost"("userId");

-- CreateIndex
CREATE INDEX "SocialPost_petId_idx" ON "SocialPost"("petId");

-- CreateIndex
CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt");

-- CreateIndex
CREATE INDEX "SocialPost_visibility_idx" ON "SocialPost"("visibility");
