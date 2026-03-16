-- CreateTable
CREATE TABLE "WatchProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "mediaKey" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "type" "MediaType" NOT NULL,
    "season" INTEGER,
    "episode" INTEGER,
    "progress" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "title" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "voteAverage" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "subtitleSize" DOUBLE PRECISION,
    "subtitleColor" TEXT,
    "subtitleBackground" TEXT,
    "subtitleBgOpacity" DOUBLE PRECISION,
    "subtitleShadow" TEXT,
    "subtitleBgEnabled" BOOLEAN,
    "subtitleAutoDetect" BOOLEAN,
    "subtitleOpacity" DOUBLE PRECISION,
    "subtitleFontFamily" TEXT,
    "subtitleFontWeight" TEXT,
    "subtitleFontStyle" TEXT,
    "subtitleDelay" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "playbackRate" DOUBLE PRECISION,
    "autoQuality" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userId_mediaKey_key" ON "WatchProgress"("userId", "mediaKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSettings_userId_key" ON "PlayerSettings"("userId");

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSettings" ADD CONSTRAINT "PlayerSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
