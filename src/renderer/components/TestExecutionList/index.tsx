import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Box, Alert, Snackbar } from '@mui/material';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import type { TestExecution } from '../../../schemas/execution';
import TestHistoryTable from './TestHistoryTable';
import Visualizer from './Visualizer';

const TestExecutionList: React.FC = () => {
  // テスト実行リストの状態
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [loading, setLoading] = useState(true);

  // 選択されたテスト実行の状態
  const [selectedExecution, setSelectedExecution] = useState<TestExecution | null>(null);
  const [errorSnackbar, setErrorSnackbar] = useState('');

  // テスト実行リストの取得
  const fetchExecutions = useCallback(async () => {
    try {
      const response = await window.electronAPI.execution.getAll();
      setExecutions(response || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'テスト実行履歴の取得に失敗しました';
      handleError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回読み込み
  useEffect(() => {
    fetchExecutions();

    // テスト実行のステータスが変更されたらリフレッシュ
    const handleExecutionUpdate = () => {
      fetchExecutions();
    };

    window.electronAPI.execution.onStatus(handleExecutionUpdate);

    return () => {
      window.electronAPI.execution.offStatus(handleExecutionUpdate);
    };
  }, [fetchExecutions]);

  // テスト実行選択ハンドラー
  const handleExecutionSelect = (execution: TestExecution) => {
    setSelectedExecution(execution);
  };

  // エラーハンドラー（子コンポーネント用）
  const handleError = (message: string) => {
    setErrorSnackbar(message);
  };

  const handleErrorSnackbarClose = () => {
    setErrorSnackbar('');
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 1,
      }}
    >
      <Allotment defaultSizes={[60, 40]}>
        <Allotment.Pane minSize={300}>
          <TestHistoryTable
            executions={executions}
            loading={loading}
            selectedExecution={selectedExecution}
            onExecutionSelect={handleExecutionSelect}
            onRefresh={fetchExecutions}
            onError={handleError}
          />
        </Allotment.Pane>

        <Allotment.Pane>
          <Visualizer selectedExecution={selectedExecution} onError={handleError} />
        </Allotment.Pane>
      </Allotment>

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorSnackbar}
        autoHideDuration={6000}
        onClose={handleErrorSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleErrorSnackbarClose} severity="error" variant="filled">
          {errorSnackbar}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TestExecutionList;
