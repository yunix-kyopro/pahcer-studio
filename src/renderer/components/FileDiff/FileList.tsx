import type React from 'react';
import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  CheckCircle as UnchangedIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import type { DiffResult, ChangeType } from '../../../services/DiffCalculationService';

interface FileListProps {
  diffResult: DiffResult;
  selectedFilePath: string;
  onFileSelect: (filePath: string) => void;
}

const FileList: React.FC<FileListProps> = ({ diffResult, selectedFilePath, onFileSelect }) => {
  const [filterTypes, setFilterTypes] = useState<ChangeType[]>([
    'added',
    'deleted',
    'modified',
    'unchanged',
  ]);

  const handleFilterChange = (
    _event: React.MouseEvent<HTMLElement>,
    newFilterTypes: ChangeType[],
  ) => {
    if (newFilterTypes.length > 0) {
      setFilterTypes(newFilterTypes);
    }
  };

  const getChangeIcon = (changeType: ChangeType) => {
    switch (changeType) {
      case 'added':
        return <AddIcon color="success" />;
      case 'deleted':
        return <RemoveIcon color="error" />;
      case 'modified':
        return <EditIcon color="warning" />;
      case 'unchanged':
        return <UnchangedIcon color="disabled" />;
      default:
        return <CodeIcon />;
    }
  };

  const getChangeColor = (changeType: ChangeType) => {
    switch (changeType) {
      case 'added':
        return 'success';
      case 'deleted':
        return 'error';
      case 'modified':
        return 'warning';
      case 'unchanged':
        return 'default';
      default:
        return 'default';
    }
  };

  const filteredFiles = diffResult.changedFiles.filter((file) =>
    filterTypes.includes(file.changeType),
  );

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Compact Header */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', backgroundColor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
          変更ファイル ({filteredFiles.length})
        </Typography>

        {/* Compact Stats */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={`+${diffResult.stats.addedFiles}`}
            color="success"
            variant="filled"
            sx={{ height: 18, fontSize: '0.6rem', minWidth: 28 }}
          />
          <Chip
            size="small"
            label={`~${diffResult.stats.modifiedFiles}`}
            color="warning"
            variant="filled"
            sx={{ height: 18, fontSize: '0.6rem', minWidth: 28 }}
          />
          <Chip
            size="small"
            label={`-${diffResult.stats.deletedFiles}`}
            color="error"
            variant="filled"
            sx={{ height: 18, fontSize: '0.6rem', minWidth: 28 }}
          />
        </Box>

        {/* Compact Filter Buttons */}
        <ToggleButtonGroup
          value={filterTypes}
          onChange={handleFilterChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              px: 0.5,
              py: 0.25,
              minWidth: 32,
              fontSize: '0.6rem',
              textTransform: 'none',
            },
          }}
        >
          <ToggleButton value="added" title="追加されたファイル">
            <AddIcon sx={{ fontSize: 14 }} />
          </ToggleButton>
          <ToggleButton value="modified" title="変更されたファイル">
            <EditIcon sx={{ fontSize: 14 }} />
          </ToggleButton>
          <ToggleButton value="deleted" title="削除されたファイル">
            <RemoveIcon sx={{ fontSize: 14 }} />
          </ToggleButton>
          <ToggleButton value="unchanged" title="変更なしファイル">
            <UnchangedIcon sx={{ fontSize: 14 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Compact File List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List disablePadding>
          {filteredFiles.map((file) => (
            <ListItem
              key={file.path}
              disablePadding
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <ListItemButton
                selected={file.path === selectedFilePath}
                onClick={() => onFileSelect(file.path)}
                sx={{
                  py: 0.5,
                  px: 1,
                  minHeight: 36,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.50',
                    borderLeft: 3,
                    borderLeftColor: 'primary.main',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 24 }}>{getChangeIcon(file.changeType)}</ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        fontWeight: file.path === selectedFilePath ? 600 : 400,
                        color: file.changeType === 'deleted' ? 'text.secondary' : 'text.primary',
                      }}
                    >
                      {file.path}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                      <Chip
                        size="small"
                        label={
                          file.changeType === 'added'
                            ? '+'
                            : file.changeType === 'deleted'
                              ? '-'
                              : file.changeType === 'modified'
                                ? '~'
                                : '='
                        }
                        color={getChangeColor(file.changeType) as any}
                        variant="outlined"
                        sx={{
                          height: 14,
                          minWidth: 16,
                          fontSize: '0.5rem',
                          '& .MuiChip-label': { px: 0.25 },
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ fontSize: '0.6rem', color: 'text.secondary' }}
                      >
                        {file.language}
                        {file.isBinary && ' (bin)'}
                      </Typography>
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {filteredFiles.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 100,
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">フィルタに一致するファイルなし</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default FileList;
