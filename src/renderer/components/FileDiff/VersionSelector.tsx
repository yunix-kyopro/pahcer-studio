import type React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel,
  Switch,
  Typography,
  Chip,
  Divider,
  Checkbox,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import type { TestExecution } from '../../../schemas/execution';

interface VersionSelectorProps {
  executions: TestExecution[];
  executionsLoading: boolean;
  selectedExecutions: string[];
  useLatest: boolean;
  onExecutionsChange: (executionIds: string[]) => void;
  onUseLatestChange: (value: boolean) => void;
  onCompare: () => void;
  onRefresh: () => void;
  comparing: boolean;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({
  executions,
  executionsLoading,
  selectedExecutions,
  useLatest,
  onExecutionsChange,
  onUseLatestChange,
  onCompare,
  onRefresh,
  comparing,
}) => {
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatScore = (score?: number | null): string => {
    if (score === null || score === undefined) return '-';
    return score.toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'RUNNING':
        return 'warning';
      case 'FAILED':
        return 'error';
      default:
        return 'default';
    }
  };

  const canCompare = useLatest ? selectedExecutions.length === 1 : selectedExecutions.length === 2;

  const handleExecutionToggle = (executionId: string) => {
    if (selectedExecutions.includes(executionId)) {
      // 選択解除
      const newSelection = selectedExecutions.filter((id) => id !== executionId);
      onExecutionsChange(newSelection);
    } else {
      // 新規選択
      const maxSelections = useLatest ? 1 : 2;
      if (selectedExecutions.length < maxSelections) {
        const newSelection = [...selectedExecutions, executionId];
        onExecutionsChange(newSelection);

        // 必要数選択されたら自動的に比較実行
        if ((useLatest && newSelection.length === 1) || (!useLatest && newSelection.length === 2)) {
          setTimeout(() => onCompare(), 100); // 少し遅延させてUI更新を先に
        }
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Controls */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h6">バージョン選択</Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={useLatest}
                onChange={(e) => onUseLatestChange(e.target.checked)}
                disabled={executionsLoading}
              />
            }
            label="現在のファイルと比較"
          />

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={executionsLoading}
            size="small"
          >
            更新
          </Button>

          <Button
            variant="contained"
            startIcon={comparing ? <CircularProgress size={16} /> : <CompareArrowsIcon />}
            onClick={onCompare}
            disabled={!canCompare || comparing || executionsLoading}
          >
            {comparing ? '比較中...' : '比較実行'}
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Version Selection Table */}
      <TableContainer component={Paper} sx={{ flexGrow: 1, height: 0 }}>
        <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1 } }}>
          <TableHead>
            <TableRow
              sx={{
                '& .MuiTableCell-head': {
                  backgroundColor: 'grey.100',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                },
              }}
            >
              <TableCell sx={{ width: 70 }}>ID</TableCell>
              <TableCell sx={{ width: 160 }}>コメント</TableCell>
              <TableCell sx={{ width: 90 }}>日時</TableCell>
              <TableCell align="right" sx={{ width: 65 }}>
                絶対
              </TableCell>
              <TableCell align="right" sx={{ width: 65 }}>
                相対
              </TableCell>
              <TableCell sx={{ width: 70 }}>状態</TableCell>
              <TableCell align="center" sx={{ width: 50 }}>
                選択
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.map((execution) => {
              const isSelected = selectedExecutions.includes(execution.id || '');
              const maxSelections = useLatest ? 1 : 2;
              const canSelect = selectedExecutions.length < maxSelections || isSelected;

              return (
                <TableRow
                  key={execution.id}
                  sx={{
                    height: 32,
                    backgroundColor: isSelected ? 'primary.50' : 'inherit',
                    '&:hover': {
                      backgroundColor: canSelect
                        ? isSelected
                          ? 'primary.100'
                          : 'grey.50'
                        : 'inherit',
                    },
                    opacity: canSelect ? 1 : 0.5,
                  }}
                >
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                    >
                      {execution.id?.substring(0, 6) || '-'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ maxWidth: 140, fontSize: '0.75rem' }}
                    >
                      {execution.comment || '-'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {formatDate(execution.startTime)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {formatScore(execution.averageScore)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {formatScore(execution.averageRelativeScore)}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={execution.status.charAt(0)}
                      size="small"
                      color={getStatusColor(execution.status) as any}
                      variant="outlined"
                      sx={{
                        minWidth: 20,
                        height: 16,
                        fontSize: '0.6rem',
                        '& .MuiChip-label': { px: 0.5 },
                      }}
                    />
                  </TableCell>

                  <TableCell align="center" sx={{ p: 0 }}>
                    {useLatest ? (
                      <Button
                        variant={isSelected ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => handleExecutionToggle(execution.id || '')}
                        disabled={executionsLoading || comparing || !canSelect}
                        sx={{
                          minWidth: 36,
                          height: 20,
                          fontSize: '0.6rem',
                          px: 0.5,
                        }}
                      >
                        比較
                      </Button>
                    ) : (
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleExecutionToggle(execution.id || '')}
                        disabled={executionsLoading || comparing || !canSelect}
                        size="small"
                        color="primary"
                        sx={{ p: 0.5 }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {executions.length === 0 && !executionsLoading && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 200,
            color: 'text.secondary',
          }}
        >
          <Typography>実行履歴がありません</Typography>
        </Box>
      )}
    </Box>
  );
};

export default VersionSelector;
