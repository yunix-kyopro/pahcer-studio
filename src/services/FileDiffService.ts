import { FileDataService } from './FileDataService';
import { DiffCalculationService, DiffResult } from './DiffCalculationService';

// 既存のAPIとの互換性のためにエイリアスを作成
export type FileDiffResult = DiffResult;

/**
 * ファイル差分表示サービス（薄いオーケストレーター）
 * FileDataServiceとDiffCalculationServiceを連携させる
 */
export class FileDiffService {
  constructor(
    private fileDataService: FileDataService,
    private diffCalculationService: DiffCalculationService,
  ) {}

  /**
   * 2つの実行IDでの差分取得（自動で古い/新しいを判別）
   */
  async getDiff(executionId1: string, executionId2: string): Promise<FileDiffResult> {
    // データ取得
    const data1 = await this.fileDataService.getExecutionFileData(executionId1);
    const data2 = await this.fileDataService.getExecutionFileData(executionId2);

    // 古い/新しいを判別
    const { older, newer } = this.fileDataService.determineOlderNewer(
      data1.execution,
      data2.execution,
    );

    // 順序を正しく調整してから差分計算
    const olderData = older.id === data1.execution.id ? data1 : data2;
    const newerData = newer.id === data1.execution.id ? data1 : data2;

    return this.diffCalculationService.calculateDiff(olderData, newerData);
  }

  /**
   * 実行IDと現行コード("latest")の差分取得
   */
  async getDiffWithLatest(executionId: string): Promise<FileDiffResult> {
    // データ取得
    const executionData = await this.fileDataService.getExecutionFileData(executionId);
    const currentData = await this.fileDataService.getCurrentFileData();

    // 実行データが古い方として差分計算
    return this.diffCalculationService.calculateDiff(executionData, currentData);
  }
}
