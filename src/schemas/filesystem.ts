import { z } from 'zod';
import { PathValidationSchema, BaseResponseSchema } from './base';

// ディレクトリ一覧関連
export const LSDirectoryRequestSchema = z.object({
  dirPath: PathValidationSchema,
  showHidden: z.boolean().optional().default(false),
  sortBy: z.enum(['name', 'size', 'date']).optional().default('name'),
});

export const LSDirectoryResponseSchema = BaseResponseSchema.extend({
  files: z.string(),
  fileCount: z.number().optional(),
});

// ファイル読み込み関連（将来用）
export const ReadFileRequestSchema = z.object({
  filePath: PathValidationSchema,
  encoding: z.enum(['utf8', 'binary']).default('utf8'),
});

export const ReadFileResponseSchema = BaseResponseSchema.extend({
  content: z.string(),
  size: z.number(),
});

// ファイル書き込み関連（将来用）
export const WriteFileRequestSchema = z.object({
  filePath: PathValidationSchema,
  content: z.string(),
  encoding: z.enum(['utf8', 'binary']).default('utf8'),
});

export const WriteFileResponseSchema = BaseResponseSchema.extend({
  bytesWritten: z.number(),
});

// 型定義
export type LSDirectoryRequest = z.infer<typeof LSDirectoryRequestSchema>;
export type LSDirectoryResponse = z.infer<typeof LSDirectoryResponseSchema>;
export type ReadFileRequest = z.infer<typeof ReadFileRequestSchema>;
export type ReadFileResponse = z.infer<typeof ReadFileResponseSchema>;
export type WriteFileRequest = z.infer<typeof WriteFileRequestSchema>;
export type WriteFileResponse = z.infer<typeof WriteFileResponseSchema>;
