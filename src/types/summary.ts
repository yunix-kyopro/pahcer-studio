/**
 * summary.json のケース単体
 */
export interface SummaryCaseRaw {
  seed: number;
  score: number | null;
  relative_score?: number;
  execution_time: number;
  error_message?: string;
}

/**
 * summary.json 全体の最低限の構造
 */
export interface SummaryJson {
  start_time?: string;
  case_count?: number;
  total_score?: number;
  total_relative_score?: number;
  max_execution_time?: number;
  comment?: string;
  wa_seeds?: number[];
  cases: SummaryCaseRaw[];
  [key: string]: unknown; // 予期しないキーを許容
}

export interface ExecutionSeedResult {
  score: number;
  status: 'success' | 'error';
  execution_time: number;
  error_message: string;
}

export interface ExecutionDataMinimal {
  executionId: string;
  comment: string;
  seeds: Record<number, ExecutionSeedResult>;
}
