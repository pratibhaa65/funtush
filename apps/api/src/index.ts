import express, { type Request, type Response } from "express";
import { db, redis } from "@funtush/database";


import agencyRoutes from './routes/agency.routes';
import { startSubscriptionCron } from "./jobs/subscriptionExpiry.job";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());

//For cron job
startSubscriptionCron();

app.use('/', agencyRoutes);


// Liveness probe consumed by Prometheus / the load balancer.
app.get("/health", async (_req: Request, res: Response) => {
  const [dbOk, redisOk] = await Promise.all([
    db.query("SELECT 1").then(() => true).catch(() => false),
    redis.ping().then((r) => r === "PONG").catch(() => false),
  ]);

  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "error",
    db: dbOk ? "ok" : "error",
    redis: redisOk ? "ok" : "error",
  });
});

app.listen(port, () => {
  console.log(`Funtush API listening on port ${port}`);
});


export { app };
