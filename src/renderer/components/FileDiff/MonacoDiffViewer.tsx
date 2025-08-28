import type React from 'react';
import { useEffect, useRef } from 'react';
import { Box, Paper, Typography, Alert } from '@mui/material';
import * as monaco from 'monaco-editor';
import type { ChangedFile } from '../../../services/DiffCalculationService';

interface MonacoDiffViewerProps {
  file: ChangedFile;
}

const MonacoDiffViewer: React.FC<MonacoDiffViewerProps> = ({ file }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup previous editor
    if (editorRef.current) {
      editorRef.current.dispose();
    }

    // Handle binary files
    if (file.isBinary) {
      return;
    }

    // Create models for old and new content
    const oldContent = file.oldContent || '';
    const newContent = file.newContent || '';

    // Determine Monaco language based on file language
    const monacoLanguage = getMonacoLanguage(file.language);

    const originalModel = monaco.editor.createModel(oldContent, monacoLanguage);
    const modifiedModel = monaco.editor.createModel(newContent, monacoLanguage);

    // Create diff editor
    const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
      theme: 'vs-dark',
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: true,
      enableSplitViewResizing: true,
      renderOverviewRuler: true,
      scrollBeyondLastLine: false,
      minimap: {
        enabled: true,
      },
      wordWrap: 'off',
      scrollbar: {
        useShadows: false,
        verticalHasArrows: true,
        horizontalHasArrows: true,
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 17,
        horizontalScrollbarSize: 17,
      },
    });

    // Set the models
    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    editorRef.current = diffEditor;

    // Cleanup function
    return () => {
      originalModel.dispose();
      modifiedModel.dispose();
      diffEditor.dispose();
    };
  }, [file]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getMonacoLanguage = (language: string): string => {
    const languageMap: Record<string, string> = {
      cpp: 'cpp',
      c: 'c',
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      java: 'java',
      csharp: 'csharp',
      php: 'php',
      ruby: 'ruby',
      go: 'go',
      rust: 'rust',
      kotlin: 'kotlin',
      swift: 'swift',
      json: 'json',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      markdown: 'markdown',
      yaml: 'yaml',
      toml: 'ini', // Monaco doesn't have native TOML support
      ini: 'ini',
      shell: 'shell',
      bat: 'bat',
      powershell: 'powershell',
      sql: 'sql',
      r: 'r',
      'objective-c': 'objective-c',
      'objective-cpp': 'objective-c',
    };

    return languageMap[language] || 'plaintext';
  };

  const getChangeTypeText = () => {
    switch (file.changeType) {
      case 'added':
        return '新規追加されたファイル';
      case 'deleted':
        return '削除されたファイル';
      case 'modified':
        return '変更されたファイル';
      case 'unchanged':
        return '変更なしのファイル';
      default:
        return '不明な変更タイプ';
    }
  };

  const getChangeTypeColor = () => {
    switch (file.changeType) {
      case 'added':
        return 'success.main';
      case 'deleted':
        return 'error.main';
      case 'modified':
        return 'warning.main';
      case 'unchanged':
        return 'text.secondary';
      default:
        return 'text.primary';
    }
  };

  if (file.isBinary) {
    return (
      <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            {file.path}
          </Typography>
          <Typography variant="body2" sx={{ color: getChangeTypeColor() }}>
            {getChangeTypeText()} • {file.language} • バイナリファイル
          </Typography>
        </Box>
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1e1e1e',
          }}
        >
          <Alert severity="info" sx={{ maxWidth: 400 }}>
            <Typography variant="body2">バイナリファイルは表示できません。</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              ファイル形式: {file.fileExtension || '不明'}
            </Typography>
            {file.changeType === 'modified' && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                このファイルに変更が加えられました。
              </Typography>
            )}
          </Alert>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          {file.path}
        </Typography>
        <Typography variant="body2" sx={{ color: getChangeTypeColor() }}>
          {getChangeTypeText()} • {file.language}
          {file.fileExtension && ` (${file.fileExtension})`}
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1 }} ref={containerRef} />
    </Paper>
  );
};

export default MonacoDiffViewer;
