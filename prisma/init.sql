-- 游戏表结构初始化（幂等操作，可重复执行）

CREATE TABLE IF NOT EXISTS "second_me_agent" (
    "id"          TEXT        NOT NULL PRIMARY KEY,
    "secondMeId"  TEXT        NOT NULL UNIQUE,
    "name"        TEXT        NOT NULL,
    "avatar"      TEXT,
    "points"      INTEGER     NOT NULL DEFAULT 100,
    "smApiToken"  TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 补列（幂等，已有列时不报错）
ALTER TABLE "second_me_agent" ADD COLUMN IF NOT EXISTS "smApiToken" TEXT;

CREATE TABLE IF NOT EXISTS "room" (
    "id"         TEXT        NOT NULL PRIMARY KEY,
    "roomName"   TEXT        NOT NULL,
    "maxAgents"  INTEGER     NOT NULL,
    "status"     TEXT        NOT NULL,
    "creatorId"  TEXT        NOT NULL,
    "antePoints" INTEGER     NOT NULL DEFAULT 5,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "room_member" (
    "id"           TEXT        NOT NULL PRIMARY KEY,
    "roomId"       TEXT        NOT NULL,
    "agentId"      TEXT        NOT NULL,
    "dicePoints"   TEXT        NOT NULL DEFAULT '[]',
    "isInGame"     BOOLEAN     NOT NULL DEFAULT TRUE,
    "isInitiative" BOOLEAN     NOT NULL DEFAULT FALSE,
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "room_member_roomId_fkey"  FOREIGN KEY ("roomId")  REFERENCES "room"("id")             ON DELETE CASCADE,
    CONSTRAINT "room_member_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "second_me_agent"("id")  ON DELETE CASCADE,
    CONSTRAINT "room_member_roomId_agentId_key" UNIQUE ("roomId", "agentId")
);

CREATE TABLE IF NOT EXISTS "game_round" (
    "id"           TEXT        NOT NULL PRIMARY KEY,
    "roomId"       TEXT        NOT NULL,
    "callerId"     TEXT        NOT NULL,
    "callNumber"   INTEGER     NOT NULL,
    "callPoint"    INTEGER     NOT NULL,
    "isZhai"       BOOLEAN     NOT NULL DEFAULT FALSE,
    "openerId"     TEXT,
    "totalPoint"   INTEGER,
    "winnerId"     TEXT,
    "loserId"      TEXT,
    "punishPoints" INTEGER,
    "roundStatus"  TEXT        NOT NULL,
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "game_round_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "game_record" (
    "id"          TEXT        NOT NULL PRIMARY KEY,
    "agentId"     TEXT        NOT NULL UNIQUE,
    "winCount"    INTEGER     NOT NULL DEFAULT 0,
    "loseCount"   INTEGER     NOT NULL DEFAULT 0,
    "playCount"   INTEGER     NOT NULL DEFAULT 0,
    "winRate"     FLOAT       NOT NULL DEFAULT 0,
    "totalPoints" INTEGER     NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "game_record_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "second_me_agent"("id") ON DELETE CASCADE
);
