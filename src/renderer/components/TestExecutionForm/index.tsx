import { useState, useEffect, useRef } from 'react';
import {
  Button,
  CardContent,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Snackbar,
  Divider,
  Paper,
  FormGroup,
  List,
  ListItem,
  ListItemText,
  Chip,
  Container,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import StopIcon from '@mui/icons-material/Stop';
import type { TestExecution, TestExecutionRequest, LogMessage } from '../../../schemas/execution';

const TestExecutionForm: React.FC = () => {
  // フォームの状態
  const [comment, setComment] = useState('');
  const [shuffle, setShuffle] = useState(false);
  const [freezeBestScores, setFreezeBestScores] = useState(false);
  const [testCaseCount, setTestCaseCount] = useState<string>('100');
  const [startSeed, setStartSeed] = useState<string>('0');

  // 送信状態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 実行状態
  const [currentExecution, setCurrentExecution] = useState<TestExecution | null>(null);
  const [executionLogs, setExecutionLogs] = useState<LogMessage[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const currentExecutionRef = useRef<TestExecution | null>(null);

  // currentExecutionが変更されたときにrefも更新
  useEffect(() => {
    currentExecutionRef.current = currentExecution;
  }, [currentExecution]);

  // ログが追加されたら自動スクロール
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executionLogs]);

  useEffect(() => {
    const handleLog = (data: {
      executionId: string;
      log: { timestamp: string; message: string };
    }) => {
      // refを使って最新のcurrentExecutionを参照
      const currentExec = currentExecutionRef.current;
      if (currentExec && data.executionId === currentExec.id) {
        setExecutionLogs((logs) => [
          ...logs,
          {
            timestamp: new Date(data.log.timestamp).toLocaleTimeString(),
            message: data.log.message,
          },
        ]);
      }
    };

    const handleStatus = (data: {
      executionId: string;
      status: string;
      execution: TestExecution;
    }) => {
      const currentExec = currentExecutionRef.current;
      if (currentExec && data.executionId === currentExec.id) {
        setCurrentExecution(data.execution);

        if (data.status === 'COMPLETED') {
          const completionMessage = `pahcer実行が完了しました。平均スコア: ${
            data.execution.averageScore?.toFixed(2) || 'N/A'
          }、平均相対スコア: ${
            data.execution.averageRelativeScore?.toFixed(3) || 'N/A'
          }%、最大実行時間: ${data.execution.maxExecutionTime?.toFixed(0) || 'N/A'} ms`;
          setSuccessMessage(completionMessage);
        } else if (data.status === 'FAILED') {
          setErrorMessage('pahcer実行が失敗しました');
        }
      }
    };

    // ElectronAPIのイベントリスナーを設定
    window.electronAPI.execution.onLog(handleLog);
    window.electronAPI.execution.onStatus(handleStatus);

    return () => {
      // クリーンアップ
      window.electronAPI.execution.offLog(handleLog);
      window.electronAPI.execution.offStatus(handleStatus);
    };
  }, []);

  // フォーム送信ハンドラー
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setExecutionLogs([]);

    try {
      // APIリクエストの作成
      const request: TestExecutionRequest = {
        comment,
        shuffle,
        freezeBestScores: freezeBestScores,
        testCaseCount: testCaseCount === '' ? 100 : parseInt(testCaseCount),
        startSeed: startSeed === '' ? 0 : parseInt(startSeed),
      };

      // Electron APIを使用してpahcer実行を開始
      const response = await window.electronAPI.execution.start(request);

      // 成功メッセージの表示
      setSuccessMessage('pahcer実行が開始されました');

      // 実行ステータスを取得
      const execution = await window.electronAPI.execution.getStatus(response.id);
      setCurrentExecution(execution);

      // フォームのリセット
      setComment('');
      setShuffle(false);
      setFreezeBestScores(false);
      setTestCaseCount('100');
      setStartSeed('0');
    } catch (error) {
      // エラー処理
      let errorMsg = 'pahcer実行の開始に失敗しました';
      if (error instanceof Error) {
        errorMsg += `: ${error.message}`;
      }
      setErrorMessage(errorMsg);
      console.error('Error starting pahcer execution:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 実行停止ハンドラー
  const handleStop = async () => {
    if (!currentExecution) return;

    try {
      await window.electronAPI.execution.stop(currentExecution.id);
      setSuccessMessage('pahcer実行を停止しました');
    } catch (error) {
      setErrorMessage('pahcer実行の停止に失敗しました');
      console.error('Error stopping execution:', error);
    }
  };

  // メッセージクリアハンドラー
  const handleSuccessClose = () => setSuccessMessage('');
  const handleErrorClose = () => setErrorMessage('');

  // ステータス関連のヘルパー関数
  type StatusColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

  const getStatusColor = (status: string): StatusColor => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'RUNNING':
        return 'info';
      case 'FAILED':
        return 'error';
      case 'CANCELLED':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '完了';
      case 'RUNNING':
        return '実行中';
      case 'FAILED':
        return '失敗';
      case 'CANCELLED':
        return 'キャンセル';
      case 'IDLE':
        return '待機中';
      default:
        return status || '不明';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleIcon />;
      case 'RUNNING':
        return <CircularProgress size={20} />;
      case 'FAILED':
        return <ErrorIcon />;
      default:
        return <PendingIcon />;
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, height: '100%', overflow: 'auto' }}>
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mb: 4 }}>
        <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 2.5, px: 4 }}>
          <Typography variant="h6">AtCoder Pahcer テスト実行</Typography>
        </Box>
        <CardContent sx={{ p: 4 }}>
          {!currentExecution ||
          currentExecution.status === 'COMPLETED' ||
          currentExecution.status === 'FAILED' ||
          currentExecution.status === 'CANCELLED' ? (
            // フォーム表示
            <form onSubmit={handleSubmit}>
              <TextField
                label="コメント"
                variant="outlined"
                fullWidth
                margin="normal"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="pahcer実行に関するコメントを入力してください"
                sx={{ mb: 4 }}
              />

              <Divider sx={{ my: 4 }} />

              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', mb: 2.5 }}>
                テスト設定
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, mb: 4 }}>
                <TextField
                  label="テストケース数"
                  variant="outlined"
                  type="number"
                  value={testCaseCount}
                  onChange={(e) => setTestCaseCount(e.target.value)}
                  InputProps={{ inputProps: { min: 1, max: 1000 } }}
                  sx={{ width: '50%' }}
                />
                <TextField
                  label="開始シード"
                  variant="outlined"
                  type="number"
                  value={startSeed}
                  onChange={(e) => setStartSeed(e.target.value)}
                  InputProps={{ inputProps: { min: 0 } }}
                  sx={{ width: '50%' }}
                />
              </Box>

              <Divider sx={{ my: 4 }} />

              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', mb: 2.5 }}>
                オプション設定
              </Typography>

              <FormGroup sx={{ ml: 2, mb: 4 }}>
                <FormControlLabel
                  sx={{ mb: 1 }}
                  control={
                    <Checkbox
                      checked={shuffle}
                      onChange={(e) => setShuffle(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="テストケースをシャッフルする"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={freezeBestScores}
                      onChange={(e) => setFreezeBestScores(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="ベストスコアを固定する"
                />
              </FormGroup>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                  sx={{ px: 4, py: 1.5 }}
                >
                  {isSubmitting ? '実行中...' : 'Pahcer実行開始'}
                </Button>
              </Box>

              {/* 完了時のスコア表示 */}
              {currentExecution?.status === 'COMPLETED' && (
                <Box sx={{ mt: 4 }}>
                  <Alert severity="success" sx={{ p: 2 }}>
                    <Typography variant="subtitle1">Pahcer実行が完了しました</Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 4,
                        mt: 1.5,
                      }}
                    >
                      <Typography variant="body2">
                        平均スコア:{' '}
                        <strong>{currentExecution.averageScore?.toFixed(2) || 'N/A'}</strong>
                      </Typography>
                      <Typography variant="body2">
                        平均相対スコア:{' '}
                        <strong>
                          {currentExecution.averageRelativeScore?.toFixed(3) || 'N/A'}%
                        </strong>
                      </Typography>
                      <Typography variant="body2">
                        最大実行時間:{' '}
                        <strong>
                          {currentExecution.maxExecutionTime
                            ? `${currentExecution.maxExecutionTime.toFixed(0)} ms`
                            : 'N/A'}
                        </strong>
                      </Typography>
                    </Box>
                  </Alert>
                </Box>
              )}
            </form>
          ) : (
            // 実行ステータス表示
            <Box>
              {/* 実行ステータスヘッダー */}
              <Box
                sx={{
                  mb: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                  <Box sx={{ mr: 1.5 }}>{getStatusIcon(currentExecution.status)}</Box>
                  <Typography variant="h6">実行ID: {currentExecution.id}</Typography>
                  <Chip
                    label={getStatusLabel(currentExecution.status)}
                    color={getStatusColor(currentExecution.status)}
                    sx={{ fontWeight: 'medium', ml: 1 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {currentExecution.status === 'RUNNING' && (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleStop}
                      startIcon={<StopIcon />}
                    >
                      停止
                    </Button>
                  )}
                  <Typography variant="body2">
                    開始時間:{' '}
                    {currentExecution.startTime
                      ? new Date(currentExecution.startTime).toLocaleString('ja-JP')
                      : '-'}
                  </Typography>
                </Box>
              </Box>

              {/* コメント表示 */}
              {currentExecution.comment && (
                <Alert severity="info" sx={{ mb: 4, p: 2 }}>
                  コメント: {currentExecution.comment}
                </Alert>
              )}

              {/* ログ表示エリア */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'medium', mb: 2 }}>
                  実行ログ
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    backgroundColor: '#1e1e1e',
                    color: '#e0e0e0',
                    p: 3,
                    height: '350px',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    borderRadius: 1.5,
                  }}
                >
                  {executionLogs.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#808080' }}>
                      ログが表示されるまでお待ちください...
                    </Typography>
                  ) : (
                    <List dense>
                      {executionLogs.map((log, index) => (
                        <ListItem key={index} sx={{ py: 0.5 }}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex' }}>
                                <Typography
                                  component="span"
                                  sx={{
                                    color: '#569cd6',
                                    mr: 2,
                                    minWidth: '80px',
                                  }}
                                >
                                  {log.timestamp}
                                </Typography>
                                <Typography component="span">{log.message}</Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                      <div ref={logsEndRef} />
                    </List>
                  )}
                </Paper>
              </Box>

              {/* 新規実行ボタン */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setCurrentExecution(null);
                    setExecutionLogs([]);
                  }}
                  sx={{ mr: 2, px: 3, py: 1 }}
                >
                  新規実行
                </Button>
              </Box>
            </Box>
          )}

          {/* 成功メッセージ */}
          <Snackbar
            open={!!successMessage}
            autoHideDuration={6000}
            onClose={handleSuccessClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert onClose={handleSuccessClose} severity="success" variant="filled">
              {successMessage}
            </Alert>
          </Snackbar>

          {/* エラーメッセージ */}
          <Snackbar
            open={!!errorMessage}
            autoHideDuration={6000}
            onClose={handleErrorClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert onClose={handleErrorClose} severity="error" variant="filled">
              {errorMessage}
            </Alert>
          </Snackbar>
        </CardContent>
      </Paper>
    </Container>
  );
};

export default TestExecutionForm;
