import { z } from 'zod';

// 共通スキーマ
export const BaseErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
});

export const BaseResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.date().default(() => new Date()),
});

// パス関連の共通バリデーション
export const PathValidationSchema = z
  .string()
  .min(1, 'パスが空です')
  .refine((path) => {
    // 危険なパスのチェック
    const dangerousPaths = [
      '/etc',
      '/var',
      '/usr/bin',
      '/System',
      '/private',
      '/Windows/System32', // Windows対応
    ];
    return !dangerousPaths.some((p) => path.startsWith(p));
  }, 'このパスへのアクセスは制限されています')
  .refine((path) => {
    // 相対パス攻撃の防止
    return !path.includes('../');
  }, '相対パス（../）は使用できません');

// 共通型定義
export type BaseError = z.infer<typeof BaseErrorSchema>;
export type BaseResponse = z.infer<typeof BaseResponseSchema>;
