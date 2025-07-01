import { z } from 'zod';

// 入力特徴量のスキーマ
export const InputFeatureSchema = z.object({
  seed: z.number(),
  file: z.string(),
  features: z.record(z.number()), // キーは特徴量名、値は特徴量値
});

// スコアデータのスキーマ
export const ScoreDataSchema = z.object({
  id: z.string(),
  scores: z.record(z.number()), // 実スコア
  relativeScores: z.record(z.number()).optional(), // 相対スコア (0〜1 など) ★追加
});

// 分析リクエストのスキーマ
export const AnalysisRequestSchema = z.object({
  executionIds: z.array(z.string()),
  featureFormat: z.string(),
});

// 分析レスポンスのスキーマ
export const AnalysisResponseSchema = z.object({
  inputFeatures: z.array(InputFeatureSchema),
  scoreData: z.array(ScoreDataSchema),
  featureKeys: z.array(z.string()),
});

// 分析データ更新リクエストのスキーマ
export const UpdateAnalysisRequestSchema = z.object({
  featureFormat: z.string(),
});

// 分析データ更新レスポンスのスキーマ
export const UpdateAnalysisResponseSchema = z.object({
  successful: z.boolean(),
  message: z.string(),
  totalTestCases: z.number().optional(),
  totalExecutions: z.number().optional(),
  extractedFeatures: z.array(z.string()).optional(),
});

// 設定取得レスポンスのスキーマ
export const AnalysisSettingsSchema = z.object({
  featureFormat: z.string(),
  scoreType: z.string(),
});

// 型定義
export type InputFeature = z.infer<typeof InputFeatureSchema>;
export type ScoreData = z.infer<typeof ScoreDataSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
export type UpdateAnalysisRequest = z.infer<typeof UpdateAnalysisRequestSchema>;
export type UpdateAnalysisResponse = z.infer<typeof UpdateAnalysisResponseSchema>;
export type AnalysisSettings = z.infer<typeof AnalysisSettingsSchema>;

// スコアタイプは廃止
export type ScoreType = never;
