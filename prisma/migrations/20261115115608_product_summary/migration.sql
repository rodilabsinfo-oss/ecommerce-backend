-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "maxPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalStock" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Product_storeId_status_minPrice_idx" ON "Product"("storeId", "status", "minPrice");
