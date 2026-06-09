import { db } from "@funtush/database";


export const approveAgencyKYCService = async (
  agencyId: string
) => {
  const kyc = await db.kycSubmission.findUnique({
    where: {
      agencyId,
    },
  });

  if (!kyc) {
    throw new Error("KYC not found");
  }

  const updatedKyc = await db.kycSubmission.update({
    where: {
      agencyId,
    },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      rejectionReason: null,
    },
  });

  return {
    kyc: updatedKyc,
    message: "KYC approved successfully",
  };
};


export const rejectAgencyKYCService = async (
  agencyId: string,
  reason: string
) => {
  const kyc = await db.kycSubmission.findUnique({
    where: {
      agencyId,
    },
  });

  if (!kyc) {
    throw new Error("KYC not found");
  }

  const updatedKyc = await db.kycSubmission.update({
    where: {
      agencyId,
    },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      reviewedAt: new Date(),
    },
  });

  return {
    kyc: updatedKyc,
    message: "KYC rejected",
  };
};