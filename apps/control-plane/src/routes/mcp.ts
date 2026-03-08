/**
 * MCP routes — proxy integration management to the MCP server.
 */

import { Router, type Request, type Response } from 'express';
import {
  getIntegrations,
  addIntegration,
  addStripePreset,
  removeIntegration,
  getMcpHealth,
} from '../lib/mcp-bridge';

export function createMCPRouter(): Router {
  const router = Router();

  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const data = await getMcpHealth();
      res.json(data);
    } catch {
      res.status(502).json({ error: 'MCP server unreachable' });
    }
  });

  router.get('/integrations', async (_req: Request, res: Response) => {
    try {
      const data = await getIntegrations();
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch integrations' });
    }
  });

  router.post('/integrations', async (req: Request, res: Response) => {
    try {
      const data = await addIntegration(req.body);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add integration' });
    }
  });

  router.post('/integrations/preset/stripe', async (_req: Request, res: Response) => {
    try {
      const data = await addStripePreset();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add Stripe preset' });
    }
  });

  router.delete('/integrations/:id', async (req: Request, res: Response) => {
    try {
      const data = await removeIntegration(req.params.id as string);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove integration' });
    }
  });

  return router;
}
