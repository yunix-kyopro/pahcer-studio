import type React from 'react';
import { Box, Paper, TextField, Button, CircularProgress } from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';

interface AnalysisSettingsProps {
  featureFormat: string;
  updating: boolean;
  onFeatureFormatChange: (value: string) => void;
  onUpdateAnalysisData: () => void;
}

const AnalysisSettings: React.FC<AnalysisSettingsProps> = ({
  featureFormat,
  updating,
  onFeatureFormatChange,
  onUpdateAnalysisData,
}) => {
  const handleFeatureFormatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFeatureFormatChange(e.target.value);
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* 特徴量フォーマット */}
        <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
          <TextField
            label="入力変数フォーマット"
            variant="outlined"
            fullWidth
            value={featureFormat}
            onChange={handleFeatureFormatChange}
            placeholder="例: N M K (空白区切り)"
            helperText="テストケース入力の最初の行の入力変数フォーマットを指定"
          />
        </Box>

        {/* 更新ボタン */}
        <Box sx={{ flex: '0 0 120px' }}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={onUpdateAnalysisData}
            startIcon={<CalculateIcon />}
            disabled={updating || !featureFormat}
          >
            {updating ? <CircularProgress size={24} color="inherit" /> : '更新'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default AnalysisSettings;
