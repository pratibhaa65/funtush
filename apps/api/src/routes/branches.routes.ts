import { Router } from "express";
import { createBranch, getAgencyBranches, updateBranch } from "src/controllers/branches.controller";
import { authenticateWithRefreshToken } from "src/middleware/refreshTokenAuthentication";
const router = Router();

router.route('/agencies/me/branches')
    .get(authenticateWithRefreshToken, getAgencyBranches)
    .post(createBranch);

router.route('/agencies/me/branches/:id')
    .patch(updateBranch);

export default router;