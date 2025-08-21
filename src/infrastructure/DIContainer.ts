import type { IExecutionRepository } from '../repositories/IExecutionRepository';
import { ExecutionRepository } from '../repositories/ExecutionRepository';
import { ProcessManager } from './ProcessManager';
import {
  FileSystemService,
  MockFileSystemService,
  IFileSystemService,
} from '../services/filesystem';
import { ConfigService } from '../services/ConfigService';
import { FileHistoryService } from '../services/FileHistoryService';
import { ScoreAnalysisService } from '../services/ScoreAnalysisService';
import { ExecutionService } from '../services/ExecutionService';

/**
 * 依存性注入コンテナ
 */
export class DIContainer {
  private static instance: DIContainer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dependencies: Map<string, any> = new Map();

  private constructor() {
    this.setupDependencies();
  }

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  private setupDependencies(): void {
    // FileSystemServiceの設定（本番環境）
    const fileSystemService = new FileSystemService();
    this.dependencies.set('IFileSystemService', fileSystemService);

    // ConfigServiceの設定
    const configService = new ConfigService(fileSystemService);
    this.dependencies.set('ConfigService', configService);

    // FileHistoryServiceの設定
    const fileHistoryService = new FileHistoryService(fileSystemService);
    this.dependencies.set('FileHistoryService', fileHistoryService);

    // ScoreAnalysisServiceの設定
    const scoreAnalysisService = new ScoreAnalysisService(configService, fileSystemService);
    this.dependencies.set('ScoreAnalysisService', scoreAnalysisService);

    // ProcessManagerの設定
    const processManager = new ProcessManager();
    this.dependencies.set('ProcessManager', processManager);

    // ExecutionRepositoryの設定
    const executionRepository = new ExecutionRepository(scoreAnalysisService, fileSystemService);
    this.dependencies.set('IExecutionRepository', executionRepository);

    // ExecutionServiceの設定
    const executionService = new ExecutionService(
      executionRepository,
      processManager,
      configService,
      scoreAnalysisService,
      fileHistoryService,
    );
    this.dependencies.set('ExecutionService', executionService);
  }

  public get<T>(key: string): T {
    const dependency = this.dependencies.get(key);
    if (!dependency) {
      throw new Error(`Dependency ${key} not found`);
    }
    return dependency;
  }

  public register<T>(key: string, instance: T): void {
    this.dependencies.set(key, instance);
  }

  // 便利メソッド
  public getFileSystemService(): IFileSystemService {
    return this.get<IFileSystemService>('IFileSystemService');
  }

  public getConfigService(): ConfigService {
    return this.get<ConfigService>('ConfigService');
  }

  public getFileHistoryService(): FileHistoryService {
    return this.get<FileHistoryService>('FileHistoryService');
  }

  public getScoreAnalysisService(): ScoreAnalysisService {
    return this.get<ScoreAnalysisService>('ScoreAnalysisService');
  }

  public getExecutionRepository(): IExecutionRepository {
    return this.get<IExecutionRepository>('IExecutionRepository');
  }

  public getProcessManager(): ProcessManager {
    return this.get<ProcessManager>('ProcessManager');
  }

  public getExecutionService(): ExecutionService {
    return this.get<ExecutionService>('ExecutionService');
  }

  // テスト用のモック注入
  public registerMock<T>(key: string, mockInstance: T): void {
    this.dependencies.set(key, mockInstance);
  }

  // テスト用コンテナのセットアップ
  public static createTestContainer(): DIContainer {
    const container = new DIContainer();
    container.dependencies.clear();

    // MockFileSystemServiceの設定（テスト環境）
    const mockFileSystemService = new MockFileSystemService();
    container.dependencies.set('IFileSystemService', mockFileSystemService);

    // ConfigServiceの設定（モック使用）
    const configService = new ConfigService(mockFileSystemService, '/mock');
    container.dependencies.set('ConfigService', configService);

    // FileHistoryServiceの設定（モック使用）
    const fileHistoryService = new FileHistoryService(
      mockFileSystemService,
      '/mock', // projectRoot
      '/mock/pahcer-studio/data/file_history', // dataDir
    );
    container.dependencies.set('FileHistoryService', fileHistoryService);

    // ScoreAnalysisServiceの設定（モック使用）
    const scoreAnalysisService = new ScoreAnalysisService(configService, mockFileSystemService);
    container.dependencies.set('ScoreAnalysisService', scoreAnalysisService);

    // ProcessManagerの設定
    const processManager = new ProcessManager();
    container.dependencies.set('ProcessManager', processManager);

    // ExecutionRepositoryの設定
    const executionRepository = new ExecutionRepository(
      scoreAnalysisService,
      mockFileSystemService,
    );
    container.dependencies.set('IExecutionRepository', executionRepository);

    // ExecutionServiceの設定（テスト用）
    const executionService = new ExecutionService(
      executionRepository,
      processManager,
      configService,
      scoreAnalysisService,
      fileHistoryService,
    );
    container.dependencies.set('ExecutionService', executionService);

    return container;
  }

  // MockFileSystemServiceの取得（テスト用）
  public getMockFileSystemService(): MockFileSystemService {
    const fileSystem = this.get<IFileSystemService>('IFileSystemService');
    if (!(fileSystem instanceof MockFileSystemService)) {
      throw new Error('MockFileSystemService is not available in production container');
    }
    return fileSystem;
  }

  // コンテナのリセット（テスト用）
  public reset(): void {
    this.dependencies.clear();
    this.setupDependencies();
  }
}
