import express from "express";
import { agencyKYCSubmission, getAgencyDashboard, registerAcency, updateAgencyDomain, updateAgencyProfile, updateAgencySubscription } from "../controllers/agency.controller.js";
import { checkAgencyStatus } from "../middlewares/agencyAccess.middleware.js";
import { acceptBooking, agencyKYCStatus, SubscriptionTiers, publishPackage } from "../controllers/agency.controller.js";
import { authenticateWithRefreshToken } from "../middlewares/refreshTokenAuthentication.js";
import { upload } from "@funtush/storage";

const router = express.Router();

router.route("/agencies/register")
    .post(registerAcency);

router.route("/subscription-tiers")
    .get(SubscriptionTiers);

router.route("/bookings")
    .patch(checkAgencyStatus, authenticateWithRefreshToken, acceptBooking);

router.route("/packages")
    .patch(checkAgencyStatus, authenticateWithRefreshToken, publishPackage);

router.route("/dashboard")
    .get(authenticateWithRefreshToken, getAgencyDashboard);

router.route("/agencies/me/subscribe")
    .patch(authenticateWithRefreshToken, updateAgencySubscription);

router.route("/agencies/me/profile")
    .patch(authenticateWithRefreshToken, updateAgencyProfile);

router.route("/agencies/me/domain")
    .patch(authenticateWithRefreshToken, updateAgencyDomain);

router.route("/agencies/me/kyc")
    .get(agencyKYCStatus)
    .post(authenticateWithRefreshToken,
        upload.fields([
            { name: "business_registration", maxCount: 1 },
            { name: "pan_certificate", maxCount: 1 },
            { name: "tourism_license", maxCount: 1 },
            { name: "bank_details", maxCount: 1 },
        ]), agencyKYCSubmission);

export default router;