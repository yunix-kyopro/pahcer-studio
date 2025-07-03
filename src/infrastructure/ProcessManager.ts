import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { TestExecutionRequest } from '../schemas/execution';

export interface PacherExecutionResult {
  success: boolean;
  executionTime: number;
  stdout: string;
  stderr: string;
  exitCode?: number;
  errorMessage?: string;
}

/**
 * pacherツール実行と、それに伴うファイル操作を管理するクラス
 */
export class ProcessManager {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private projectRoot: string;
  private resultsDir: string;

  constructor() {
    // pacher_electron/がプロジェクトルートの1階層下にある前提
    this.projectRoot = path.resolve(process.cwd(), '..');
    this.resultsDir = path.join(process.cwd(), 'data', 'results');
  }

  /**
   * pacherツールを実行する
   */
  async executePacher(
    request: TestExecutionRequest,
    executionId: string,
    onLog: (log: string) => void,
  ): Promise<PacherExecutionResult> {
    const startTime = Date.now();
    const executionDir = path.join(this.resultsDir, executionId);

    try {
      // 実行ディレクトリと初期情報JSONを作成
      await fs.mkdir(executionDir, { recursive: true });
      const initialInfo = {
        id: executionId,
        status: 'RUNNING',
        startTime: new Date().toISOString(),
        comment: request.comment,
        totalCount: request.testCaseCount,
      };
      await fs.writeFile(
        path.join(executionDir, 'execution_info.json'),
        JSON.stringify(initialInfo, null, 2),
      );

      // tools/out をバックアップ
      await this.backupOutDirectory(executionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[${executionId}] Failed to create execution directory or initial info: ${message}`,
      );
      // この時点で失敗した場合は、プロセスを実行せずにエラーを返す
      return {
        success: false,
        executionTime: Date.now() - startTime,
        stdout: '',
        stderr: `Failed to create execution directory or initial info: ${message}`,
        errorMessage: `Failed to create execution directory or initial info: ${message}`,
      };
    }

    return new Promise((resolve) => {
      try {
        const cmd = this.buildPacherCommand(request);

        const child = spawn(cmd[0], cmd.slice(1), {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: this.projectRoot,
        });

        this.activeProcesses.set(executionId, child);

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          const log = data.toString();
          stdout += log;
          onLog(log);
        });
        child.stderr?.on('data', (data) => {
          const log = data.toString();
          stderr += log;
          onLog(log);
        });

        child.on('close', async (code) => {
          this.activeProcesses.delete(executionId);
          const executionTime = Date.now() - startTime;
          const success = code === 0;

          if (success) {
            try {
              await this.saveTestResults(executionId);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.error(`[${executionId}] Failed to save results: ${message}`);
            }
          }

          // tools/out_bak を復元
          try {
            await this.restoreOutDirectory(executionId);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[${executionId}] Failed to restore out directory: ${message}`);
          }

          resolve({
            success,
            executionTime,
            stdout,
            stderr,
            exitCode: code ?? undefined,
            errorMessage: success ? undefined : stderr || `Process exited with code ${code}`,
          });
        });

        child.on('error', async (error) => {
          this.activeProcesses.delete(executionId);

          // エラー時も復元を試みる
          try {
            await this.restoreOutDirectory(executionId);
          } catch (restoreError) {
            const message =
              restoreError instanceof Error ? restoreError.message : String(restoreError);
            console.error(
              `[${executionId}] Failed to restore out directory after error: ${message}`,
            );
          }

          resolve({
            success: false,
            executionTime: Date.now() - startTime,
            stdout,
            stderr,
            errorMessage: error.message,
          });
        });

        child.stdin?.end();
      } catch (error) {
        // spawn自体のエラー
        const message = error instanceof Error ? error.message : String(error);
        resolve({
          success: false,
          executionTime: Date.now() - startTime,
          stdout: '',
          stderr: message,
          errorMessage: message,
        });
      }
    });
  }

  /**
   * pacherコマンドの引数配列を構築する
   * Pythonコード(pahcer_service.py)の仕様に合わせる
   */
  private buildPacherCommand(request: TestExecutionRequest): string[] {
    const cmd = ['pahcer', 'run'];

    if (request.comment) cmd.push('-c', request.comment);
    if (request.shuffle) cmd.push('--shuffle');
    if (request.freezeBestScores) cmd.push('--freeze-best-scores');
    // Note: Pythonコードでは -n (test_case_count) や -s (start_seed) は
    // pahcer run の引数として渡されていなかったため、ここでも含めない。
    // これらのパラメータはpahcer_config.toml等で制御される想定。

    return cmd;
  }

  /**
   * プロセスを強制終了する
   */
  killProcess(executionId: string): boolean {
    const process = this.activeProcesses.get(executionId);
    if (process) {
      process.kill('SIGKILL');
      this.activeProcesses.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * テスト結果を実行IDごとのフォルダに保存する
   * Pythonコード(_save_test_results)のロジックを再現
   */
  private async saveTestResults(executionId: string): Promise<void> {
    const executionDir = path.join(this.resultsDir, executionId);

    // 1. 最新のサマリーJSONをコピー
    const jsonDir = path.join(this.projectRoot, 'pahcer', 'json');
    try {
      // コピー元のディレクトリが存在するか確認
      await fs.access(jsonDir);

      const jsonFiles = (await fs.readdir(jsonDir)).filter((f) => f.endsWith('.json'));
      if (jsonFiles.length > 0) {
        const fileStats = await Promise.all(
          jsonFiles.map(async (file) => {
            const filePath = path.join(jsonDir, file);
            const stat = await fs.stat(filePath);
            return { file, stat };
          }),
        );
        const latestFile = fileStats.sort(
          (a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime(),
        )[0];

        const srcPath = path.join(jsonDir, latestFile.file);
        const destPath = path.join(executionDir, 'summary.json');
        await fs.copyFile(srcPath, destPath);
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'ENOENT') {
        console.error(`[${executionId}] Source directory for summary not found: ${jsonDir}`);
      } else {
        console.error(`[${executionId}] Could not save summary.json. Error:`, error);
      }
    }

    // 2. ケースごとの出力ファイルをコピー
    const outDir = path.join(this.projectRoot, 'tools', 'out');
    const caseOutputsDir = path.join(executionDir, 'case_outputs');
    try {
      await fs.mkdir(caseOutputsDir, { recursive: true });
      const outFiles = await fs.readdir(outDir);
      for (const file of outFiles) {
        if (file.endsWith('.txt')) {
          const caseNum = parseInt(path.basename(file, '.txt'));
          if (!isNaN(caseNum)) {
            const destName = `${String(caseNum).padStart(4, '0')}.txt`;
            const srcPath = path.join(outDir, file);
            const destPath = path.join(caseOutputsDir, destName);
            await fs.copyFile(srcPath, destPath);
          }
        }
      }
    } catch {
      // tools/out not found is normal in some cases
    }
  }

  /**
   * tools/out が存在する場合、tools/out_bak にバックアップする
   */
  private async backupOutDirectory(executionId: string): Promise<void> {
    const outDir = path.join(this.projectRoot, 'tools', 'out');
    const outBakDir = path.join(this.projectRoot, 'tools', 'out_bak');

    try {
      // tools/out が存在するかチェック
      await fs.access(outDir);

      // tools/out_bak が既に存在する場合は削除
      try {
        await fs.access(outBakDir);
        await fs.rm(outBakDir, { recursive: true, force: true });
      } catch {
        // out_bak が存在しない場合は無視
      }

      // tools/out を tools/out_bak にリネーム
      await fs.rename(outDir, outBakDir);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'ENOENT') {
        console.info(`[${executionId}] tools/out does not exist, skipping backup`);
      } else {
        console.error(`[${executionId}] Failed to backup out directory:`, error);
        throw error;
      }
    }
  }

  /**
   * tools/out_bak が存在する場合、tools/out を削除してから tools/out_bak を tools/out に復元する
   */
  private async restoreOutDirectory(executionId: string): Promise<void> {
    const outDir = path.join(this.projectRoot, 'tools', 'out');
    const outBakDir = path.join(this.projectRoot, 'tools', 'out_bak');

    try {
      // tools/out_bak が存在するかチェック
      await fs.access(outBakDir);

      // tools/out が存在する場合は削除
      try {
        await fs.access(outDir);
        await fs.rm(outDir, { recursive: true, force: true });
      } catch {
        // tools/out が存在しない場合は無視
        console.info(`[${executionId}] tools/out does not exist, skipping restoration`);
      }

      // tools/out_bak を tools/out にリネーム
      await fs.rename(outBakDir, outDir);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'ENOENT') {
        console.info(`[${executionId}] tools/out_bak does not exist, skipping restoration`);
      } else {
        console.error(`[${executionId}] Failed to restore out directory:`, error);
        throw error;
      }
    }
  }
}
