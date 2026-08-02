-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'STAFF');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('TRIBUTO', 'EN_VIVO', 'DJ', 'KARAOKE', 'STANDUP', 'FIESTA', 'ESPECIAL');

-- CreateEnum
CREATE TYPE "CardTier" AS ENUM ('CLASICA', 'PLATA', 'ORO');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENT_OFF', 'AMOUNT_OFF', 'TWO_FOR_ONE', 'FREE_ITEM', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EDITOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "category" "EventCategory" NOT NULL DEFAULT 'EN_VIVO',
    "excerpt" TEXT,
    "description" TEXT,
    "posterUrl" TEXT,
    "coverUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "doorsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "priceCents" INTEGER,
    "ticketUrl" TEXT,
    "capacity" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "ratingLock" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_ratings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "icon" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_products" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "caption" TEXT,
    "eventId" TEXT,
    "tag" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "acceptsNews" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barzu_cards" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "tier" "CardTier" NOT NULL DEFAULT 'CLASICA',
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "points" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barzu_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "terms" TEXT,
    "imageUrl" TEXT,
    "type" "PromotionType" NOT NULL DEFAULT 'PERCENT_OFF',
    "value" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "minTier" "CardTier" NOT NULL DEFAULT 'CLASICA',
    "maxPerCard" INTEGER NOT NULL DEFAULT 1,
    "maxTotal" INTEGER NOT NULL DEFAULT 0,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "pointsReward" INTEGER NOT NULL DEFAULT 0,
    "availableWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "staffUserId" TEXT,
    "receiptCode" TEXT NOT NULL,
    "note" TEXT,
    "pointsSpent" INTEGER NOT NULL DEFAULT 0,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "barName" TEXT NOT NULL DEFAULT 'BARZUO',
    "tagline" TEXT NOT NULL DEFAULT 'Restobar · Lounge & Club',
    "logoUrl" TEXT,
    "logoAltUrl" TEXT,
    "faviconUrl" TEXT,
    "heroTitle" TEXT NOT NULL DEFAULT 'BARZUO',
    "heroSubtitle" TEXT,
    "heroEyebrow" TEXT DEFAULT 'EST. 2024',
    "heroImageUrl" TEXT,
    "heroVideoUrl" TEXT,
    "heroCtaLabel" TEXT DEFAULT 'Ver cartelera',
    "heroCtaHref" TEXT DEFAULT '/eventos',
    "heroCtaSecondaryLabel" TEXT DEFAULT 'Ver la carta',
    "heroCtaSecondaryHref" TEXT DEFAULT '/carta',
    "aboutTitle" TEXT DEFAULT 'Nuestra historia',
    "aboutLead" TEXT,
    "aboutBody" TEXT,
    "aboutImageUrl" TEXT,
    "aboutSecondaryImageUrl" TEXT,
    "address" TEXT NOT NULL DEFAULT 'Av. Presidente Jose Batlle y Ordonez 3714',
    "addressCity" TEXT NOT NULL DEFAULT 'Montevideo, Uruguay',
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT -34.8544,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT -56.1712,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "reservationsNote" TEXT,
    "footerNote" TEXT,
    "seoTitle" TEXT NOT NULL DEFAULT 'BARZUO Restobar · Musica en vivo, tributos y cocteleria',
    "seoDescription" TEXT NOT NULL DEFAULT 'BARZUO Restobar en Montevideo. Cartelera de shows en vivo, tributos, DJ y la mejor cocteleria de autor.',
    "seoImageUrl" TEXT,
    "seoKeywords" TEXT,
    "googleAnalyticsId" TEXT,
    "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "loyaltyTitle" TEXT NOT NULL DEFAULT 'BarzuCard',
    "loyaltyDescription" TEXT,
    "loyaltyTerms" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_hours" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_published_startsAt_idx" ON "events"("published", "startsAt");

-- CreateIndex
CREATE INDEX "events_featured_published_idx" ON "events"("featured", "published");

-- CreateIndex
CREATE INDEX "events_category_idx" ON "events"("category");

-- CreateIndex
CREATE INDEX "event_ratings_eventId_approved_idx" ON "event_ratings"("eventId", "approved");

-- CreateIndex
CREATE UNIQUE INDEX "event_ratings_eventId_fingerprint_key" ON "event_ratings"("eventId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_slug_key" ON "menu_categories"("slug");

-- CreateIndex
CREATE INDEX "menu_categories_active_position_idx" ON "menu_categories"("active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "menu_products_slug_key" ON "menu_products"("slug");

-- CreateIndex
CREATE INDEX "menu_products_categoryId_position_idx" ON "menu_products"("categoryId", "position");

-- CreateIndex
CREATE INDEX "menu_products_available_featured_idx" ON "menu_products"("available", "featured");

-- CreateIndex
CREATE INDEX "gallery_images_active_position_idx" ON "gallery_images"("active", "position");

-- CreateIndex
CREATE INDEX "gallery_images_eventId_idx" ON "gallery_images"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "media_url_key" ON "media"("url");

-- CreateIndex
CREATE INDEX "media_createdAt_idx" ON "media"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "barzu_cards_memberId_key" ON "barzu_cards"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "barzu_cards_cardNumber_key" ON "barzu_cards"("cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "barzu_cards_qrToken_key" ON "barzu_cards"("qrToken");

-- CreateIndex
CREATE INDEX "barzu_cards_status_idx" ON "barzu_cards"("status");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_slug_key" ON "promotions"("slug");

-- CreateIndex
CREATE INDEX "promotions_active_position_idx" ON "promotions"("active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_receiptCode_key" ON "redemptions"("receiptCode");

-- CreateIndex
CREATE INDEX "redemptions_cardId_redeemedAt_idx" ON "redemptions"("cardId", "redeemedAt");

-- CreateIndex
CREATE INDEX "redemptions_promotionId_idx" ON "redemptions"("promotionId");

-- CreateIndex
CREATE INDEX "social_links_active_position_idx" ON "social_links"("active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "opening_hours_dayOfWeek_key" ON "opening_hours"("dayOfWeek");

-- CreateIndex
CREATE INDEX "contact_messages_read_createdAt_idx" ON "contact_messages"("read", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "event_ratings" ADD CONSTRAINT "event_ratings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_ratings" ADD CONSTRAINT "event_ratings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_products" ADD CONSTRAINT "menu_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barzu_cards" ADD CONSTRAINT "barzu_cards_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "barzu_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
