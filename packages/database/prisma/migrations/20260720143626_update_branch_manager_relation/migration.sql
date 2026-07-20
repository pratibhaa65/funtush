-- DropForeignKey
ALTER TABLE "branches" DROP CONSTRAINT "branches_manager_staff_id_fkey";

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_manager_staff_id_fkey" FOREIGN KEY ("manager_staff_id") REFERENCES "agency_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
