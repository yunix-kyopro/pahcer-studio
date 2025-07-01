import type React from 'react';
import { useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  CircularProgress,
  Box,
  TablePagination,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import type { TestExecution, TestExecutionStatus } from '../../../schemas/execution';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';

interface TestHistoryTableProps {
  executions: TestExecution[];
  loading: boolean;
  selectedExecution: TestExecution | null;
  onExecutionSelect: (execution: TestExecution) => void;
  onRefresh: () => void;
  onError: (message: string) => void;
}

const TestHistoryTable: React.FC<TestHistoryTableProps> = ({
  executions,
  loading,
  selectedExecution,
  onExecutionSelect,
  onRefresh,
  onError,
}) => {
  // テーブル内部の状態
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [executionToDelete, setExecutionToDelete] = useState<TestExecution | null>(null);
  const [deleting, setDeleting] = useState(false);

  // テーブルヘッダーの定義
  const columnDefinitions = [
    {
      key: 'id',
      label: 'ID',
      minWidth: 50,
      tooltip: '実行ID',
      icon: <InfoIcon fontSize="small" sx={{ opacity: 0.6 }} />,
    },
    {
      key: 'comment',
      label: 'コメント',
      minWidth: 120,
    },
    {
      key: 'startTime',
      label: '開始時間',
      minWidth: 80,
      tooltip: '実行開始時間',
      icon: <TimelapseIcon fontSize="small" sx={{ opacity: 0.6 }} />,
    },
    {
      key: 'status',
      label: 'ステータス',
      minWidth: 80,
    },
    {
      key: 'score',
      label: 'スコア',
      minWidth: 80,
      tooltip: '平均スコア (指数表記)',
      icon: <AssessmentIcon fontSize="small" sx={{ opacity: 0.6 }} />,
    },
    {
      key: 'relativeScore',
      label: '相対スコア',
      minWidth: 90,
      tooltip: '最高スコアに対する相対スコア (%)',
      icon: <AssessmentIcon fontSize="small" sx={{ opacity: 0.6 }} />,
    },
    {
      key: 'logScore',
      label: 'Log₁₀',
      minWidth: 80,
      tooltip: 'Log10(平均スコア)',
      icon: <AssessmentIcon fontSize="small" sx={{ opacity: 0.6 }} />,
    },
    {
      key: 'maxTime',
      label: '最大時間',
      minWidth: 80,
      tooltip: '最大実行時間 (ミリ秒)',
      icon: <TimelapseIcon fontSize="small" sx={{ opacity: 0.6 }} />,
    },
    {
      key: 'testCount',
      label: 'テスト数',
      minWidth: 80,
      tooltip: '成功数 / 総テスト数',
      icon: <PlaylistAddCheckIcon fontSize="small" sx={{ opacity: 0.6 }} />,
    },
    {
      key: 'actions',
      label: '操作',
      minWidth: 60,
    },
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDeleteClick = (event: React.MouseEvent, execution: TestExecution) => {
    event.stopPropagation();
    setExecutionToDelete(execution);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!executionToDelete?.id) return;

    setDeleting(true);
    try {
      await window.electronAPI.execution.deleteExecution(executionToDelete.id);
      setDeleteDialogOpen(false);
      setExecutionToDelete(null);
      // 削除成功後にリフレッシュ
      await onRefresh();
    } catch (err) {
      console.error('Error deleting execution:', err);
      onError('テスト実行の削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setExecutionToDelete(null);
  };

  const getStatusColor = (status: TestExecutionStatus | undefined) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'RUNNING':
        return 'info';
      case 'FAILED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: TestExecutionStatus | undefined) => {
    switch (status) {
      case 'COMPLETED':
        return '完了';
      case 'RUNNING':
        return '実行中';
      case 'FAILED':
        return '失敗';
      case 'IDLE':
        return '待機中';
      default:
        return status || '不明';
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const currentPageData = executions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Paper
        elevation={2}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          borderRadius: 2,
        }}
      >
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          p: 0.5,
          borderBottom: '1px solid rgba(224, 224, 224, 1)',
        }}
      >
        <Tooltip title="更新">
          <IconButton size="small" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Table stickyHeader size="small" padding="none">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
              {columnDefinitions.map((column) => (
                <TableCell
                  key={column.key}
                  sx={{
                    fontWeight: 'bold',
                    py: 0.5,
                    px: 1,
                    minWidth: column.minWidth,
                  }}
                >
                  {column.tooltip ? (
                    <Tooltip title={column.tooltip} arrow>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {column.label}
                        {column.icon}
                      </Box>
                    </Tooltip>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {currentPageData.map((execution) => (
              <TableRow
                key={execution.id}
                hover
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 },
                  cursor: 'pointer',
                  backgroundColor:
                    selectedExecution?.id === execution.id ? 'rgba(0, 0, 0, 0.08)' : 'inherit',
                }}
                onClick={() => onExecutionSelect(execution)}
              >
                <TableCell sx={{ fontFamily: 'monospace', py: 0.5, px: 1 }}>
                  {execution.id?.substring(0, 4) || '-'}
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>{execution.comment || '-'}</TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>{formatDate(execution.startTime)}</TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>
                  <Chip
                    label={getStatusLabel(execution.status)}
                    color={getStatusColor(execution.status)}
                    size="small"
                    sx={{ fontWeight: 'medium', height: '20px' }}
                  />
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>
                  {execution.averageScore ? execution.averageScore.toExponential(2) : '-'}
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>
                  {execution.averageRelativeScore !== undefined &&
                  execution.averageRelativeScore !== null
                    ? `${(execution.averageRelativeScore * 100).toFixed(2)}%`
                    : '-'}
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>
                  {execution.averageScore && execution.averageScore > 0
                    ? Math.log10(execution.averageScore).toFixed(4)
                    : '-'}
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>
                  {execution.maxExecutionTime ? `${execution.maxExecutionTime.toFixed(2)}ms` : '-'}
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>
                  {execution.acceptedCount !== undefined && execution.totalCount !== undefined
                    ? `${execution.acceptedCount}/${execution.totalCount}`
                    : '-'}
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>
                  <Tooltip title="削除" disableFocusListener>
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteClick(e, execution)}
                      color="error"
                      disabled={deleting}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={executions.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="表示件数:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} / ${count !== -1 ? count : `${to}以上`}`
        }
        sx={{ py: 0 }}
      />

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">テスト実行の削除</DialogTitle>
        <DialogContent>
          <Typography>
            このテスト実行を削除してもよろしいですか？
            <br />
            ID: {executionToDelete?.id?.substring(0, 4)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            キャンセル
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={deleting}>
            {deleting ? <CircularProgress size={16} /> : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TestHistoryTable;
