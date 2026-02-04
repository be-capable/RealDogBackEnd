-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DogEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "petId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "stateType" TEXT,
    "contextType" TEXT,
    "confidence" REAL,
    "audioUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputTranscript" TEXT,
    "meaningText" TEXT,
    "mode" TEXT,
    "outputAudioUrl" TEXT,
    CONSTRAINT "DogEvent_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DogEvent" ("audioUrl", "confidence", "contextType", "createdAt", "eventType", "id", "inputTranscript", "meaningText", "mode", "outputAudioUrl", "petId", "stateType") SELECT "audioUrl", "confidence", "contextType", "createdAt", "eventType", "id", "inputTranscript", "meaningText", "mode", "outputAudioUrl", "petId", "stateType" FROM "DogEvent";
DROP TABLE "DogEvent";
ALTER TABLE "new_DogEvent" RENAME TO "DogEvent";
CREATE TABLE "new_DogTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "petId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DogTask_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DogTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DogTask" ("createdAt", "error", "id", "petId", "result", "status", "type", "updatedAt", "userId") SELECT "createdAt", "error", "id", "petId", "result", "status", "type", "updatedAt", "userId" FROM "DogTask";
DROP TABLE "DogTask";
ALTER TABLE "new_DogTask" RENAME TO "DogTask";
CREATE TABLE "new_PetMedia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "petId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PetMedia_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PetMedia" ("contentType", "createdAt", "durationMs", "height", "id", "objectKey", "petId", "sizeBytes", "type", "width") SELECT "contentType", "createdAt", "durationMs", "height", "id", "objectKey", "petId", "sizeBytes", "type", "width" FROM "PetMedia";
DROP TABLE "PetMedia";
ALTER TABLE "new_PetMedia" RENAME TO "PetMedia";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
