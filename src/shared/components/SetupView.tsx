import { useState } from 'react';
import { setVaultPath } from '../storage';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { FolderOpen, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

type SetupStatus = 'idle' | 'saving' | 'success' | 'error';

interface SetupViewProps {
  onComplete?: () => void;
}

export function SetupView({ onComplete }: SetupViewProps) {
  const [showCustomPath, setShowCustomPath] = useState(false);
  const [vaultPath, setVaultPathValue] = useState('~/Documents');
  const [commentFolder, setCommentFolder] = useState('Jot');
  const [status, setStatus] = useState<SetupStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
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

      setTimeout(() => {
        onComplete?.();
      }, 500);
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Failed to save configuration';

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

  // Simple confirmation view
  if (!showCustomPath) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
            <FolderOpen className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Where to save?</h1>
          <p className="text-sm text-muted-foreground">
            Choose where Jot should store the local files for your bookmarks.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-center text-sm">
            Save bookmarks to <code className="px-2 py-1 bg-muted rounded">~/Documents/Jot/</code>?
          </p>

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
              'Yes'
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={() => setShowCustomPath(true)}
            disabled={status === 'saving' || status === 'success'}
            className="w-full"
          >
            Choose a different location
          </Button>
        </div>
      </div>
    );
  }

  // Custom path form view
  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <FolderOpen className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Where to save?</h1>
        <p className="text-sm text-muted-foreground">
          Choose where Jot should store the local files for your bookmarks.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vault-path">Folder Path</Label>
          <p className="text-xs text-muted-foreground">
            To get a folder path: open Finder, navigate to the folder, then press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Cmd</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Option</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">C</kbd> to copy its path.
          </p>
          <Input
            id="vault-path"
            type="text"
            placeholder="~/Documents"
            value={vaultPath}
            onChange={(e) => setVaultPathValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status === 'saving'}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment-folder">Subfolder Name</Label>
          <p className="text-xs text-muted-foreground">
            Jot will create this folder inside your chosen location
          </p>
          <Input
            id="comment-folder"
            type="text"
            placeholder="Jot"
            value={commentFolder}
            onChange={(e) => setCommentFolder(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status === 'saving'}
          />
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
            'Use this location'
          )}
        </Button>

        <Button
          variant="ghost"
          onClick={() => setShowCustomPath(false)}
          disabled={status === 'saving' || status === 'success'}
          className="w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="pt-4 border-t space-y-2">
        <p className="text-xs text-muted-foreground text-center">
          Your comments will be saved to:
        </p>
        <p className="text-xs text-center">
          <code className="px-2 py-1 bg-muted rounded">
            .../{vaultPath.split('/').filter(Boolean).pop() || 'folder'}/{commentFolder || 'Jot'}/
          </code>
        </p>
      </div>
    </div>
  );
}
