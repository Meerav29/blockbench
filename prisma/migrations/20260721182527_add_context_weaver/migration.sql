-- CreateEnum
CREATE TYPE "PageKind" AS ENUM ('GENERAL', 'MEETING', 'ROADMAP', 'TASK', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'DISMISSED', 'APPROVED');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('CONTEXTUAL');

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "kind" "PageKind" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "PageRelation" (
    "id" TEXT NOT NULL,
    "sourcePageId" TEXT NOT NULL,
    "targetPageId" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL DEFAULT 'CONTEXTUAL',
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationSuggestion" (
    "id" TEXT NOT NULL,
    "sourcePageId" TEXT NOT NULL,
    "targetPageId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageRelation_sourcePageId_targetPageId_key" ON "PageRelation"("sourcePageId", "targetPageId");

-- CreateIndex
CREATE UNIQUE INDEX "RelationSuggestion_sourcePageId_targetPageId_key" ON "RelationSuggestion"("sourcePageId", "targetPageId");

-- AddForeignKey
ALTER TABLE "PageRelation" ADD CONSTRAINT "PageRelation_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageRelation" ADD CONSTRAINT "PageRelation_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationSuggestion" ADD CONSTRAINT "RelationSuggestion_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationSuggestion" ADD CONSTRAINT "RelationSuggestion_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
