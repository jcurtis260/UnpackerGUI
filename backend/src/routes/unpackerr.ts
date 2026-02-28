import { Router } from "express";
import { z } from "zod";
import type { UnpackerrManager } from "../services/unpackerrManager.js";
import type { ConfigService } from "../services/configService.js";
import type { LogStreamService } from "../services/logStreamService.js";
import type { UiPreferencesService } from "../services/uiPreferencesService.js";
import type { FileBrowserService } from "../services/fileBrowserService.js";
import type { FileQueueService } from "../services/fileQueueService.js";
import type { ToolInstallService } from "../services/toolInstallService.js";

const configSchema = z.object({
  raw: z.string().min(1)
});

const preferencesSchema = z.object({
  monitorCollapsed: z.boolean().optional(),
  progressMode: z.enum(["estimated_from_logs", "activity_only", "strict_percent_only"]).optional()
});

const listFilesQuerySchema = z.object({
  rootId: z.string().min(1),
  path: z.string().optional()
});

const queueEnqueueSchema = z.object({
  rootId: z.string().min(1),
  relativePath: z.string().min(1)
});

const queueCancelSchema = z.object({
  id: z.string().min(1)
});

const installToolSchema = z.object({
  tool: z.enum(["7z", "unrar"])
});

export function createUnpackerrRouter(
  manager: UnpackerrManager,
  config: ConfigService,
  logs: LogStreamService,
  uiPreferences: UiPreferencesService,
  fileBrowser: FileBrowserService,
  fileQueue: FileQueueService,
  toolInstaller: ToolInstallService
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

  router.get("/preferences", async (_req, res, next) => {
    try {
      res.json(await uiPreferences.read());
    } catch (error) {
      next(error);
    }
  });

  router.put("/preferences", async (req, res, next) => {
    try {
      const parsed = preferencesSchema.parse(req.body);
      res.json(await uiPreferences.update(parsed));
    } catch (error) {
      next(error);
    }
  });

  router.get("/files/mounts", async (_req, res, next) => {
    try {
      res.json({
        mounts: fileBrowser.getMountRoots()
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/files/list", async (req, res, next) => {
    try {
      const parsed = listFilesQuerySchema.parse({
        rootId: req.query.rootId,
        path: req.query.path
      });
      res.json(await fileBrowser.list(parsed.rootId, parsed.path ?? ""));
    } catch (error) {
      next(error);
    }
  });

  router.get("/queue", async (_req, res, next) => {
    try {
      res.json(fileQueue.getSnapshot());
    } catch (error) {
      next(error);
    }
  });

  router.post("/queue", async (req, res, next) => {
    try {
      const parsed = queueEnqueueSchema.parse(req.body);
      res.json(await fileQueue.enqueue(parsed.rootId, parsed.relativePath));
    } catch (error) {
      next(error);
    }
  });

  router.post("/queue/:id/cancel", async (req, res, next) => {
    try {
      const parsed = queueCancelSchema.parse(req.params);
      res.json(await fileQueue.cancel(parsed.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/tools/status", async (_req, res, next) => {
    try {
      res.json(await toolInstaller.getStatus());
    } catch (error) {
      next(error);
    }
  });

  router.post("/tools/install", async (req, res, next) => {
    try {
      const parsed = installToolSchema.parse(req.body);
      res.json(await toolInstaller.install(parsed.tool));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
