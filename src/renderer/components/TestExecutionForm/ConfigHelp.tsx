import React from 'react';
import { Tooltip, IconButton, Typography, Box } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const ConfigHelp: React.FC = () => {
  const helpContent = (
    <Box sx={{ maxWidth: '450px', p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
        ファイル履歴機能の設定
      </Typography>

      <Typography variant="body2" sx={{ mb: 1.5 }}>
        テスト実行時にファイルやフォルダを自動バックアップできます。プロジェクトルートの
        <strong>pahcer_config.toml</strong>に以下を追加してください：
      </Typography>

      <Box
        sx={{
          backgroundColor: '#2d2d2d',
          color: '#f8f8f2',
          p: 1.5,
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          mb: 1.5,
        }}
      >
        <div>[[pahcer-studio]]</div>
        <div>save_path_list = [</div>
        <div>&nbsp;&nbsp;&quot;src/main.cpp&quot;,</div>
        <div>&nbsp;&nbsp;&quot;src/&quot;,</div>
        <div>&nbsp;&nbsp;&quot;Makefile&quot;,</div>
        <div>&nbsp;&nbsp;&quot;README.md&quot;</div>
        <div>]</div>
      </Box>

      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 'medium', color: '#ed6c02' }}>
        📁 コピー先
      </Typography>
      <Typography variant="body2" sx={{ mb: 1.5, fontSize: '0.85rem' }}>
        ファイルは <strong>pahcer-studio/data/{`{test_id}`}/</strong> にコピーされます
      </Typography>

      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 'medium', color: '#ed6c02' }}>
        ⚙️ 設定のルール
      </Typography>
      <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 1.5 }}>
        • <strong>相対パス</strong>で指定（絶対パスは使用不可）
        <br />
        • ファイルとフォルダの両方を指定可能
        <br />• フォルダを指定すると中身も<strong>再帰的にコピー</strong>
        <br />• <strong>合計5MB、100ファイルまで</strong>の制限あり
        <br />• 末尾の&quot;/&quot;は自動で正規化（src/とsrcは同じ）
      </Typography>
    </Box>
  );

  return (
    <Tooltip
      title={helpContent}
      placement="left"
      arrow
      sx={{
        '& .MuiTooltip-tooltip': {
          backgroundColor: '#ffffff',
          color: '#333333',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: '1px solid #e0e0e0',
          maxWidth: 'none',
        },
        '& .MuiTooltip-arrow': {
          color: '#ffffff',
          '&:before': {
            border: '1px solid #e0e0e0',
          },
        },
      }}
    >
      <IconButton size="small" sx={{ color: 'primary.main' }}>
        <HelpOutlineIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};

export default ConfigHelp;
