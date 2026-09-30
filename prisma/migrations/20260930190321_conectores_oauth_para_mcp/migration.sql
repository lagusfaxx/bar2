-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "secretHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "resource" TEXT,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "accessHash" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_clients_clientId_key" ON "oauth_clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_codes_codeHash_key" ON "oauth_codes"("codeHash");

-- CreateIndex
CREATE INDEX "oauth_codes_expiresAt_idx" ON "oauth_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_accessHash_key" ON "oauth_tokens"("accessHash");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_refreshHash_key" ON "oauth_tokens"("refreshHash");

-- CreateIndex
CREATE INDEX "oauth_tokens_userId_idx" ON "oauth_tokens"("userId");

-- CreateIndex
CREATE INDEX "oauth_tokens_clientId_idx" ON "oauth_tokens"("clientId");

-- AddForeignKey
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
