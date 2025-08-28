import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Paper, Typography, Alert, Chip } from '@mui/material';
import { Allotment } from 'allotment';
import type { DiffResult } from '../../../services/DiffCalculationService';
import type { TestExecution } from '../../../schemas/execution';
import VersionSelector from './VersionSelector';
import FileList from './FileList';
import MonacoDiffViewer from './MonacoDiffViewer';

const FileDiff: React.FC = () => {
  // State management
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [selectedExecutions, setSelectedExecutions] = useState<string[]>([]);
  const [useLatest, setUseLatest] = useState(false);

  const handleUseLatestChange = (value: boolean) => {
    setUseLatest(value);
    // useLatest切り替え時に選択をリセット
    setSelectedExecutions([]);
    setDiffResult(null);
  };
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Load executions on component mount
  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    setExecutionsLoading(true);
    try {
      const result = await window.electronAPI.execution.getAll();
      setExecutions(result);
      setError('');
    } catch (err) {
      setError(`実行一覧の取得に失敗しました: ${err}`);
    } finally {
      setExecutionsLoading(false);
    }
  };

  const handleCompare = async () => {
    if (useLatest && selectedExecutions.length !== 1) {
      setError('比較するバージョンを1つ選択してください');
      return;
    }

    if (!useLatest && selectedExecutions.length !== 2) {
      setError('比較するバージョンを2つ選択してください');
      return;
    }

    setDiffLoading(true);
    setError('');
    try {
      let result: DiffResult;
      if (useLatest) {
        result = await window.electronAPI.diff.getDiffWithLatest(selectedExecutions[0]);
      } else {
        // 2つの実行比較（バックエンドで自動的に時刻順判別）
        result = await window.electronAPI.diff.getDiff(
          selectedExecutions[0],
          selectedExecutions[1],
        );
      }
      setDiffResult(result);

      // Select the first changed file if available
      if (result.changedFiles.length > 0) {
        setSelectedFilePath(result.changedFiles[0].path);
      }
    } catch (err) {
      setError(`差分の取得に失敗しました: ${err}`);
      setDiffResult(null);
    } finally {
      setDiffLoading(false);
    }
  };

  const selectedFile = diffResult?.changedFiles.find((file) => file.path === selectedFilePath);

  // 時刻フォーマット関数
  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 時間差計算
  const getTimeDiff = (older: string, newer: string) => {
    const diffMs = new Date(newer).getTime() - new Date(older).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffSeconds = Math.floor((diffMs % 60000) / 1000);

    if (diffMinutes > 0) {
      return `${diffMinutes}分${diffSeconds}秒`;
    } else {
      return `${diffSeconds}秒`;
    }
  };

  // 比較情報コンポーネント
  const ComparisonInfo: React.FC<{ diffResult: DiffResult }> = ({ diffResult }) => (
    <Paper sx={{ mb: 2, p: 2, bgcolor: 'info.50', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          比較結果:
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`${diffResult.olderExecution.id.substring(0, 8)}`}
            size="small"
            color="default"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(diffResult.olderExecution.timestamp)}
          </Typography>
        </Box>

        <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
          →
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={
              diffResult.newerExecution.id === 'current'
                ? '現在'
                : `${diffResult.newerExecution.id.substring(0, 8)}`
            }
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(diffResult.newerExecution.timestamp)}
          </Typography>
        </Box>

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            時間差:{' '}
            {getTimeDiff(diffResult.olderExecution.timestamp, diffResult.newerExecution.timestamp)}
          </Typography>
          <Chip
            label={`${diffResult.stats.modifiedFiles}件変更`}
            size="small"
            color="warning"
            variant="filled"
            sx={{ fontSize: '0.7rem' }}
          />
        </Box>
      </Box>
    </Paper>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          ファイル差分比較
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* 比較情報表示 */}
      {diffResult && <ComparisonInfo diffResult={diffResult} />}

      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <Allotment defaultSizes={[35, 65]} vertical={false}>
          {/* Left Pane: Version Selection */}
          <Allotment.Pane minSize={350} maxSize={600}>
            <Paper sx={{ height: '100%', p: 1.5 }}>
              <VersionSelector
                executions={executions}
                executionsLoading={executionsLoading}
                selectedExecutions={selectedExecutions}
                useLatest={useLatest}
                onExecutionsChange={setSelectedExecutions}
                onUseLatestChange={handleUseLatestChange}
                onCompare={handleCompare}
                onRefresh={loadExecutions}
                comparing={diffLoading}
              />
            </Paper>
          </Allotment.Pane>

          {/* Right Pane: File Diff Display */}
          <Allotment.Pane>
            {diffResult ? (
              <Allotment defaultSizes={[25, 75]} vertical={false}>
                {/* File List - Left Bottom */}
                <Allotment.Pane minSize={200} maxSize={350}>
                  <FileList
                    diffResult={diffResult}
                    selectedFilePath={selectedFilePath}
                    onFileSelect={setSelectedFilePath}
                  />
                </Allotment.Pane>

                {/* Diff Viewer - Right */}
                <Allotment.Pane>
                  {selectedFile ? (
                    <MonacoDiffViewer file={selectedFile} />
                  ) : (
                    <Paper
                      sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#1e1e1e',
                      }}
                    >
                      <Typography color="textSecondary">ファイルを選択してください</Typography>
                    </Paper>
                  )}
                </Allotment.Pane>
              </Allotment>
            ) : (
              <Paper
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                }}
              >
                <Typography variant="h6" color="textSecondary">
                  バージョンを選択して比較を実行してください
                </Typography>
              </Paper>
            )}
          </Allotment.Pane>
        </Allotment>
      </Box>
    </Box>
  );
};

export default FileDiff;
