-- Initial SQLite migration for the Rádio Disney analytics prototype.

CREATE TABLE "Role" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL
);
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "sensitive" BOOLEAN NOT NULL DEFAULT false,
  "before" JSONB,
  "after" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Listener" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phoneOriginal" TEXT,
  "phoneNormalized" TEXT,
  "email" TEXT,
  "cpfMasked" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "rawData" JSONB
);

CREATE TABLE "ChallengeParticipation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "time" TEXT NOT NULL,
  "listenerId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "winner" BOOLEAN NOT NULL DEFAULT false,
  "partnerFlag" TEXT,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ChallengeParticipation_listenerId_fkey" FOREIGN KEY ("listenerId") REFERENCES "Listener" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ChallengeWinnerDetails" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "participationId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "cpfMasked" TEXT NOT NULL,
  "cpfHash" TEXT,
  "appDownloaded" BOOLEAN,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ChallengeWinnerDetails_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "ChallengeParticipation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ChallengeWinnerDetails_participationId_key" ON "ChallengeWinnerDetails"("participationId");

CREATE TABLE "XuguedEREpisode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "episodeNumber" INTEGER NOT NULL,
  "theme" TEXT NOT NULL,
  "character" TEXT NOT NULL,
  "airedDate" TEXT NOT NULL,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Program" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Program_name_key" ON "Program"("name");
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");

CREATE TABLE "ProgramParticipation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "notes" TEXT,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProgramParticipation_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProgramParticipation_date_programId_key" ON "ProgramParticipation"("date", "programId");

CREATE TABLE "MusicRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "artistOriginal" TEXT NOT NULL,
  "artistNormalized" TEXT NOT NULL,
  "songOriginal" TEXT NOT NULL,
  "songNormalized" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "programId" TEXT,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MusicRequest_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SeasonalPromotion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "channel" TEXT,
  "startDate" TEXT,
  "endDate" TEXT,
  "participationCount" INTEGER,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "CompetitorRadio" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CompetitorRadio_name_key" ON "CompetitorRadio"("name");

CREATE TABLE "CompetitorPromotion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "radioId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "duration" TEXT,
  "mechanic" TEXT NOT NULL,
  "channel" TEXT,
  "referenceMonth" TEXT NOT NULL,
  "status" TEXT,
  "tags" TEXT,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CompetitorPromotion_radioId_fkey" FOREIGN KEY ("radioId") REFERENCES "CompetitorRadio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AwardedSong" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "day" TEXT NOT NULL,
  "position" INTEGER,
  "songOriginal" TEXT,
  "artist" TEXT,
  "title" TEXT,
  "referenceMonth" TEXT NOT NULL,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "BreakItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "weekdays" TEXT,
  "frequencyComment" TEXT,
  "entryDate" TEXT,
  "exitDate" TEXT,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "PollIdea" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" TEXT,
  "onAirPoll" TEXT,
  "suggestion" TEXT,
  "reason" TEXT,
  "participations" INTEGER,
  "referenceWeek" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IDEIA',
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "module" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "processedRows" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ImportError" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER,
  "message" TEXT NOT NULL,
  "rawData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
