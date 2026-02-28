import { Router } from "express";
import { z } from "zod";
import type { UnpackerrManager } from "../services/unpackerrManager.js";
import type { ConfigService } from "../services/configService.js";
import type { LogStreamService } from "../services/logStreamService.js";

const configSchema = z.object({
  raw: z.string().min(1)
});

export function createUnpackerrRouter(
  manager: UnpackerrManager,
  config: ConfigService,
  logs: LogStreamService
): Router {
  const router = Router();

  router.get("/status", async (_req, res, next) => {
    try {
      res.json(await manager.getStatus());
    } catch (error) {
      next(error);
    }
  });

  router.post("/install", async (_req, res, next) => {
    try {
      res.json(await manager.install(false));
    } catch (error) {
      next(error);
    }
  });

  router.post("/upgrade", async (_req, res, next) => {
    try {
      res.json(await manager.upgrade());
    } catch (error) {
      next(error);
    }
  });

  router.post("/start", async (_req, res, next) => {
    try {
      res.json(await manager.start());
    } catch (error) {
      next(error);
    }
  });

  router.post("/stop", async (_req, res, next) => {
    try {
      res.json(await manager.stop());
    } catch (error) {
      next(error);
    }
  });

  router.post("/restart", async (_req, res, next) => {
    try {
      res.json(await manager.restart());
    } catch (error) {
      next(error);
    }
  });

  router.get("/logs", async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 200);
      const fileLines = await manager.readLogTail(limit);
      res.json({
        tail: fileLines,
        events: logs.getHistory(limit)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/config", async (_req, res, next) => {
    try {
      res.json(await config.readConfig());
    } catch (error) {
      next(error);
    }
  });

  router.put("/config", async (req, res, next) => {
    try {
      const parsed = configSchema.parse(req.body);
      res.json(await config.writeConfig(parsed.raw));
    } catch (error) {
      next(error);
    }
  });

  router.post("/config/validate", async (req, res, next) => {
    try {
      const parsed = configSchema.parse(req.body);
      const result = config.validateRaw(parsed.raw);
      if (!result.valid) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
