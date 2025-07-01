import { z } from 'zod';

/**
 * `openapi.yaml`: components.schemas.TestExecutionStatus
 *
 * NOTE: `CANCELLED` はアプリの内部ロジックで使われているため、
 * OpenAPIの定義にはありませんが、互換性のために追加しています。
 */
export const TestExecutionStatusSchema = z.enum([
  'IDLE',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

/**
 * `openapi.yaml`: components.schemas.TestCase
 */
export const TestCaseSchema = z.object({
  seed: z.number().int(),
  score: z.number().nullable(),
  relativeScore: z.number().nullable(),
  status: z.enum(['waiting', 'running', 'completed', 'failed']),
  executionTime: z.number().nullable(), // Milliseconds
});

/**
 * `openapi.yaml`: components.schemas.TestExecution
 */
export const TestExecutionSchema = z.object({
  id: z.string(),
  status: TestExecutionStatusSchema,
  startTime: z.string().optional(),
  comment: z.string().nullable(),
  averageScore: z.number().optional().nullable(),
  averageRelativeScore: z.number().optional().nullable(),
  acceptedCount: z.number().int().optional().nullable(),
  totalCount: z.number().int().optional().nullable(),
  maxExecutionTime: z.number().optional().nullable(), // Milliseconds
});

/**
 * `openapi.yaml`: components.schemas.TestExecutionRequest
 */
export const TestExecutionRequestSchema = z.object({
  comment: z.string().nullable(),
  shuffle: z.boolean().default(false),
  freezeBestScores: z.boolean().default(false),
  testCaseCount: z.number().int().min(1).default(100),
  startSeed: z.number().int().min(0).default(0),
});

/**
 * `openapi.yaml`: components.schemas.LogMessage
 */
export const LogMessageSchema = z.object({
  timestamp: z.string(),
  message: z.string(),
});

// Zodスキーマからの型推論
export type TestExecutionStatus = z.infer<typeof TestExecutionStatusSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestExecution = z.infer<typeof TestExecutionSchema>;
export type TestExecutionRequest = z.infer<typeof TestExecutionRequestSchema>;
export type LogMessage = z.infer<typeof LogMessageSchema>;

// 汎用レスポンス: 成否のみ
export const SimpleSuccessResponseSchema = z.object({
  success: z.boolean(),
});

// execution:start 等で使用する ID レスポンス
export const IdResponseSchema = z.object({
  id: z.string(),
});

export type SimpleSuccessResponse = z.infer<typeof SimpleSuccessResponseSchema>;
export type IdResponse = z.infer<typeof IdResponseSchema>;

// ===== イベントペイロード =====
export const ExecutionLogEventSchema = z.object({
  executionId: z.string(),
  log: LogMessageSchema,
});

export const ExecutionStatusEventSchema = z.object({
  executionId: z.string(),
  status: TestExecutionStatusSchema,
  execution: TestExecutionSchema,
});

export const ExecutionProgressEventSchema = z.object({
  executionId: z.string(),
  progress: z.number(),
});

export type ExecutionLogEvent = z.infer<typeof ExecutionLogEventSchema>;
export type ExecutionStatusEvent = z.infer<typeof ExecutionStatusEventSchema>;
export type ExecutionProgressEvent = z.infer<typeof ExecutionProgressEventSchema>;
