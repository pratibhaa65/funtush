import { upload } from "@funtush/storage";
import { Router } from "express";
import { createReview, flagReview, getReviews, reviewResponse } from "src/controllers/review.controller";

const router = Router();

router.route('/reviews')
    .post(upload.array("photos", 10), createReview);

router.route('/agencies/:slug/reviews')
    .get(getReviews);

router.route('/agencies/:id/response')
    .post(reviewResponse);

router.route('/agencies/:id/flag')
    .post(flagReview);

 
export default router;