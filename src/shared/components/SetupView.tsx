import { useState } from 'react';
import { setVaultPath, getConfig } from '../storage';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { FolderOpen, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type SetupStatus = 'idle' | 'saving' | 'success' | 'error';

interface SetupViewProps {
  onComplete?: () => void;
}

export function SetupView({ onComplete }: SetupViewProps) {
  const [vaultPath, setVaultPathValue] = useState('');
  const [commentFolder, setCommentFolder] = useState('Jot');
  const [status, setStatus] = useState<SetupStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    // Strip quotes that macOS adds when copying paths with spaces
    const cleanPath = vaultPath.trim().replace(/^['"]|['"]$/g, '');

    if (!cleanPath) {
      setError('Please enter a folder path');
      return;
    }

    setStatus('saving');
    setError(null);

    try {
      await setVaultPath(cleanPath, commentFolder.trim() || 'Jot');
      setStatus('success');

      // Brief delay to show success state
      setTimeout(() => {
        onComplete?.();
      }, 500);
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Failed to save configuration';

      // Handle specific error codes
      if (message.includes('PATH_NOT_FOUND') || message.includes('does not exist')) {
        setError('That folder does not exist. Please check the path and try again.');
      } else if (message.includes('Native host')) {
        setError('Jot helper is not installed. Please run the installer first.');
      } else {
        setError(message);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && status !== 'saving') {
      void handleSave();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-md mx-auto">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <FolderOpen className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Set up Jot</h1>
        <p className="text-sm text-muted-foreground">
          Choose where to save your comments as markdown files.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vault-path">Folder Path</Label>
          <Input
            id="vault-path"
            type="text"
            placeholder="/Users/you/Documents/MyFolder"
            value={vaultPath}
            onChange={(e) => setVaultPathValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status === 'saving'}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            To get a folder path: open Finder, navigate to the folder, then press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Cmd</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Option</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">C</kbd> to copy its path.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment-folder">Subfolder Name</Label>
          <Input
            id="comment-folder"
            type="text"
            placeholder="Jot"
            value={commentFolder}
            onChange={(e) => setCommentFolder(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status === 'saving'}
          />
          <p className="text-xs text-muted-foreground">
            Jot will create this folder inside your chosen location
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {status === 'success' && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Connected! Starting Jot...</span>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={status === 'saving' || status === 'success'}
          className="w-full"
        >
          {status === 'saving' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : status === 'success' ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Connected
            </>
          ) : (
            'Save & Continue'
          )}
        </Button>
      </div>

      <div className="pt-4 border-t space-y-2">
        <p className="text-xs text-muted-foreground text-center">
          Your comments will be saved to:
        </p>
        <p className="text-xs text-center">
          <code className="px-2 py-1 bg-muted rounded">{vaultPath || '...'}/{commentFolder || 'Jot'}/</code>
        </p>
      </div>
    </div>
  );
}
