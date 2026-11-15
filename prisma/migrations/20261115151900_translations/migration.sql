-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';
