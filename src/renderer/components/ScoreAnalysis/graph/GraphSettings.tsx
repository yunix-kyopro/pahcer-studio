import type React from 'react';
import { Box, TextField, Button, Checkbox, FormControlLabel } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface GraphSettingsProps {
  currentXAxis: string;
  currentInputFilter: string;
  onXAxisChange: (value: string) => void;
  onInputFilterChange: (value: string) => void;
  useLogScale: boolean;
  onToggleLogScale: (value: boolean) => void;
  useRelativeScore: boolean;
  onToggleRelativeScore: (value: boolean) => void;
  onApply: () => void;
  applying: boolean;
}

const GraphSettings: React.FC<GraphSettingsProps> = ({
  currentXAxis,
  currentInputFilter,
  onXAxisChange,
  onInputFilterChange,
  useLogScale,
  onToggleLogScale,
  useRelativeScore,
  onToggleRelativeScore,
  onApply,
  applying,
}) => {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        label="X軸(入力変数またはseed)"
        value={currentXAxis}
        onChange={(e) => onXAxisChange(e.target.value)}
        size="small"
        sx={{ minWidth: 120 }}
        placeholder="入力変数または数式"
      />

      <TextField
        label="入力フィルター"
        value={currentInputFilter}
        onChange={(e) => onInputFilterChange(e.target.value)}
        size="small"
        sx={{ minWidth: 120 }}
      />

      <FormControlLabel
        control={
          <Checkbox checked={useLogScale} onChange={(e) => onToggleLogScale(e.target.checked)} />
        }
        label="ログスケール (Y軸)"
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={useRelativeScore}
            onChange={(e) => onToggleRelativeScore(e.target.checked)}
          />
        }
        label="相対スコアを使用"
      />

      <Button
        variant="contained"
        color="primary"
        onClick={onApply}
        disabled={applying}
        startIcon={<PlayArrowIcon />}
        size="small"
      >
        反映
      </Button>
    </Box>
  );
};

export default GraphSettings;
