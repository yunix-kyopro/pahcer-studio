import type React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import type { TestExecution } from '../../../schemas/execution';

interface ExecutionSelectionTableProps {
  executions: TestExecution[];
  selectedExecutionIds: string[];
  executionsLoading: boolean;
  onToggleExecution: (id: string) => void;
  onClearAllSelections: () => void;
}

const ExecutionSelectionTable: React.FC<ExecutionSelectionTableProps> = ({
  executions,
  selectedExecutionIds,
  executionsLoading,
  onToggleExecution,
  onClearAllSelections,
}) => {
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 2,
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6">テスト実行リスト</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={onClearAllSelections}
            disabled={selectedExecutionIds.length === 0}
          >
            選択解除
          </Button>
        </Box>
      </Box>

      {/* 実行リストの表示 */}
      {executionsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 300 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">選択</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>コメント</TableCell>
                <TableCell>開始時間</TableCell>
                <TableCell>平均スコア</TableCell>
                <TableCell>テスト数</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {executions.map((execution) => (
                <TableRow
                  key={execution.id}
                  selected={selectedExecutionIds.includes(execution.id!)}
                  onClick={() => execution.id && onToggleExecution(execution.id)}
                  hover
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedExecutionIds.includes(execution.id!)}
                      onChange={() => execution.id && onToggleExecution(execution.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>{execution.id?.substring(0, 8)}</TableCell>
                  <TableCell>{execution.comment || '-'}</TableCell>
                  <TableCell>
                    {execution.startTime
                      ? new Date(execution.startTime).toLocaleString('ja-JP')
                      : '-'}
                  </TableCell>
                  <TableCell>{execution.averageScore?.toFixed(2) || '-'}</TableCell>
                  <TableCell>
                    {execution.acceptedCount || 0}/{execution.totalCount || 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default ExecutionSelectionTable;
