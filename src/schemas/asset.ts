import { z } from 'zod';

// downloadVisualizer のレスポンス
export const DownloadVisualizerResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  urls: z.array(z.string()).optional(),
});

// getVisualizerEntry のレスポンス
export const VisualizerEntryResponseSchema = z.object({
  exists: z.boolean(),
  entry: z.string().nullable(),
});

export type DownloadVisualizerResponse = z.infer<typeof DownloadVisualizerResponseSchema>;
export type VisualizerEntryResponse = z.infer<typeof VisualizerEntryResponseSchema>;
