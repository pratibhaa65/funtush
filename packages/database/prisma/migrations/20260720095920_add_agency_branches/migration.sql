-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "manager_staff_id" TEXT,
    "is_head_office" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branches_agency_id_idx" ON "branches"("agency_id");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_manager_staff_id_fkey" FOREIGN KEY ("manager_staff_id") REFERENCES "agency_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
