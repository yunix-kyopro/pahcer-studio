import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { ExecutionService } from './services/ExecutionService';
import { AnalysisService } from './services/AnalysisService';
import { DIContainer } from './infrastructure/DIContainer';
import type { TestExecutionRequest } from './schemas/execution';
import type { AnalysisRequest, UpdateAnalysisRequest } from './schemas/analysis';
import * as fsPromises from 'fs/promises';
import { AssetDownloadService } from './services/AssetDownloadService';

let mainWindow: BrowserWindow;
let executionService: ExecutionService;
let analysisService: AnalysisService;

function createWindow(): void {
  // メインウィンドウを作成
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    title: 'AtCoder Test Runner',
  });

  // HTMLファイルを読み込み
  mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));

  // 開発者ツールを開く（開発時のみ）
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function setupExecutionService(): void {
  // DIContainerから依存関係を取得
  const container = DIContainer.getInstance();
  const executionRepository = container.getExecutionRepository();
  const processManager = container.getProcessManager();

  // ExecutionServiceを依存性注入で構築
  executionService = new ExecutionService(executionRepository, processManager);

  // ExecutionServiceのイベントをレンダラープロセスに転送
  executionService.on('execution:status', (data) => {
    mainWindow?.webContents.send('execution:status', data);
  });

  executionService.on('execution:progress', (data) => {
    mainWindow?.webContents.send('execution:progress', data);
  });

  executionService.on('execution:log', (data) => {
    mainWindow?.webContents.send('execution:log', data);
  });

  executionService.on('execution:completed', (data) => {
    mainWindow?.webContents.send('execution:completed', data);
  });
}

function setupAnalysisService(): void {
  // AnalysisServiceを初期化
  analysisService = new AnalysisService();
}

ipcMain.handle('execution:start', async (event, request: TestExecutionRequest) => {
  const executionId = await executionService.startExecution(request);
  return { id: executionId };
});

ipcMain.handle('execution:stop', async (event, executionId: string) => {
  await executionService.stopExecution(executionId);
  return { success: true };
});

ipcMain.handle('execution:getStatus', async (event, executionId: string) => {
  return executionService.getExecutionStatus(executionId);
});

ipcMain.handle('execution:getAll', async () => {
  return executionService.getAllExecutions();
});

ipcMain.handle('execution:getTestCases', async (event, executionId: string) => {
  return executionService.getTestCases(executionId);
});

ipcMain.handle(
  'execution:getTestCaseResult',
  async (event, { executionId, seed }: { executionId: string; seed: number }) => {
    return executionService.getTestCaseResult(executionId, seed);
  },
);

ipcMain.handle('execution:delete', async (event, executionId: string) => {
  await executionService.deleteExecution(executionId);
});

// 分析関連のIPCハンドラー
ipcMain.handle('analysis:analyze', async (event, request: AnalysisRequest) => {
  return await analysisService.analyze(request);
});

ipcMain.handle('analysis:updateCache', async (event, request: UpdateAnalysisRequest) => {
  return await analysisService.updateFeatureCache(request.featureFormat);
});

ipcMain.handle('analysis:getSettings', async () => {
  return analysisService.getSettings();
});

ipcMain.handle(
  'analysis:saveSettings',
  async (event, { featureFormat }: { featureFormat: string }) => {
    return analysisService.saveSettings(featureFormat);
  },
);

ipcMain.handle('asset:deleteVisualizer', async () => {
  const dir = path.join(__dirname, '../public/visualizer');
  try {
    await fsPromises.rm(dir, { recursive: true, force: true });
    await fsPromises.mkdir(dir, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ビジュアライザフォルダ内で唯一の HTML ファイル名を返す
ipcMain.handle('asset:getVisualizerEntry', async () => {
  const dir = path.join(__dirname, '../public/visualizer');
  try {
    const files = await fsPromises.readdir(dir);
    const htmls = files.filter((f) => f.toLowerCase().endsWith('.html'));
    if (htmls.length === 1) {
      return { exists: true, entry: htmls[0] };
    }
    return { exists: false, entry: null };
  } catch {
    return { exists: false, entry: null };
  }
});

// ダウンロード: HTML + 直接参照 JS を保存（AssetDownloadService に任せる）
ipcMain.handle('asset:downloadVisualizer', async (event, { url }: { url: string }) => {
  const dir = path.join(__dirname, '../public/visualizer');
  try {
    const svc = new AssetDownloadService(dir);
    const urls = await svc.download(url);
    return { success: true, urls };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// アプリケーションの準備ができたらウィンドウを作成
app.whenReady().then(() => {
  setupExecutionService();
  setupAnalysisService();
  createWindow();
});

// すべてのウィンドウが閉じられたときの処理
app.on('window-all-closed', () => {
  // macOS以外では、すべてのウィンドウが閉じられたらアプリを終了
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// アプリがアクティブになったときの処理（macOS用）
app.on('activate', () => {
  // ウィンドウがない場合は新しく作成
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
