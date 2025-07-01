import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  TestExecutionRequest,
  ExecutionLogEvent,
  ExecutionStatusEvent,
  ExecutionProgressEvent,
} from './schemas/execution';
import type { AnalysisRequest, UpdateAnalysisRequest } from './schemas/analysis';
import type { ElectronAPI } from './types/electron-api';

// IPC リスナーのラッパーを保持するマップ (callback -> wrappedListener)
const listenerMaps = {
  log: new WeakMap<
    (data: ExecutionLogEvent) => void,
    (event: IpcRendererEvent, data: ExecutionLogEvent) => void
  >(),
  status: new WeakMap<
    (data: ExecutionStatusEvent) => void,
    (event: IpcRendererEvent, data: ExecutionStatusEvent) => void
  >(),
  progress: new WeakMap<
    (data: ExecutionProgressEvent) => void,
    (event: IpcRendererEvent, data: ExecutionProgressEvent) => void
  >(),
} as const;

// レンダラープロセス（フロントエンド）に公開するAPIの定義
const electronAPI: ElectronAPI = {
  getVersion: () => {
    console.warn('getVersion is not implemented in main process');
    return Promise.resolve('v0.0.0');
  },
  execution: {
    start: (request: TestExecutionRequest): Promise<{ id: string }> =>
      ipcRenderer.invoke('execution:start', request),
    stop: (executionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('execution:stop', executionId),
    getStatus: (executionId: string) => ipcRenderer.invoke('execution:getStatus', executionId),
    getAll: () => ipcRenderer.invoke('execution:getAll'),
    getTestCases: (executionId: string) =>
      ipcRenderer.invoke('execution:getTestCases', executionId),
    getTestCaseResult: (executionId: string, seed: number) =>
      ipcRenderer.invoke('execution:getTestCaseResult', { executionId, seed }),
    deleteExecution: (executionId: string) => ipcRenderer.invoke('execution:delete', executionId),
    onLog: (callback: (data: ExecutionLogEvent) => void) => {
      const wrapper = (_event: IpcRendererEvent, data: ExecutionLogEvent) => callback(data);
      listenerMaps.log.set(callback, wrapper);
      ipcRenderer.on('execution:log', wrapper);
    },
    offLog: (callback: (data: ExecutionLogEvent) => void) => {
      const wrapper = listenerMaps.log.get(callback);
      if (wrapper) ipcRenderer.removeListener('execution:log', wrapper);
    },
    onStatus: (callback: (data: ExecutionStatusEvent) => void) => {
      const wrapper = (_event: IpcRendererEvent, data: ExecutionStatusEvent) => callback(data);
      listenerMaps.status.set(callback, wrapper);
      ipcRenderer.on('execution:status', wrapper);
    },
    offStatus: (callback: (data: ExecutionStatusEvent) => void) => {
      const wrapper = listenerMaps.status.get(callback);
      if (wrapper) ipcRenderer.removeListener('execution:status', wrapper);
    },
    onProgress: (callback: (data: ExecutionProgressEvent) => void) => {
      const wrapper = (_event: IpcRendererEvent, data: ExecutionProgressEvent) => callback(data);
      listenerMaps.progress.set(callback, wrapper);
      ipcRenderer.on('execution:progress', wrapper);
    },
    offProgress: (callback: (data: ExecutionProgressEvent) => void) => {
      const wrapper = listenerMaps.progress.get(callback);
      if (wrapper) ipcRenderer.removeListener('execution:progress', wrapper);
    },
  },
  analysis: {
    analyze: (request: AnalysisRequest) => ipcRenderer.invoke('analysis:analyze', request),
    updateCache: (request: UpdateAnalysisRequest) =>
      ipcRenderer.invoke('analysis:updateCache', request),
    getSettings: () => ipcRenderer.invoke('analysis:getSettings'),
    saveSettings: (featureFormat: string) =>
      ipcRenderer.invoke('analysis:saveSettings', { featureFormat }),
  },
  asset: {
    deleteVisualizer: () => ipcRenderer.invoke('asset:deleteVisualizer'),
    downloadVisualizer: (url: string) => ipcRenderer.invoke('asset:downloadVisualizer', { url }),
    getVisualizerEntry: () => ipcRenderer.invoke('asset:getVisualizerEntry'),
  },
};

// `contextBridge`を使って、安全にAPIをレンダラープロセスに公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 型定義は src/types/electron-api.d.ts で共通管理しているため、ここでは不要です
