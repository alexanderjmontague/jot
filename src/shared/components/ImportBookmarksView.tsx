import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, Upload } from 'lucide-react';
import { flattenChromeBookmarks, parseHtmlBookmarks, type ChromeBookmarkNode } from '../bookmarks';
import { importBookmarks, type ImportBookmark } from '../storage';

type ImportSource = 'browser' | 'file' | null;
type ImportState = 'select' | 'loading' | 'empty' | 'ready' | 'importing' | 'done' | 'error';

interface ImportBookmarksViewProps {
  onComplete: () => void;
}

export function ImportBookmarksView({ onComplete }: ImportBookmarksViewProps) {
  const [source, setSource] = useState<ImportSource>(null);
  const [state, setState] = useState<ImportState>('select');
  const [bookmarks, setBookmarks] = useState<ImportBookmark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch browser bookmarks when browser source is selected
  useEffect(() => {
    if (source !== 'browser') return;

    const fetchBookmarks = async () => {
      setState('loading');
      try {
        const tree = await chrome.bookmarks.getTree();
        const root = tree[0]?.children ?? [];
        const mapped = flattenChromeBookmarks(root as ChromeBookmarkNode[]);

        if (mapped.length === 0) {
          setState('empty');
        } else {
          setBookmarks(mapped);
          setState('ready');
        }
      } catch (err) {
        console.error('Failed to read Chrome bookmarks', err);
        setError('Failed to read Chrome bookmarks. Make sure the extension has the bookmarks permission.');
        setState('error');
      }
    };

    void fetchBookmarks();
  }, [source]);

  const handleSelectBrowser = () => {
    setSource('browser');
  };

  const handleSelectFile = () => {
    setSource('file');
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User cancelled - go back to selection
      setSource(null);
      return;
    }

    setState('loading');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const html = event.target?.result as string;
        const parsed = parseHtmlBookmarks(html);

        if (parsed.length === 0) {
          setState('empty');
        } else {
          setBookmarks(parsed);
          setState('ready');
        }
      } catch (err) {
        console.error('Failed to parse bookmark file', err);
        setError('Failed to parse bookmark file. Make sure it\'s a valid HTML bookmark export.');
        setState('error');
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file.');
      setState('error');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setState('importing');
    setError(null);

    try {
      const importResult = await importBookmarks(bookmarks);
      setResult(importResult);
      setState('done');
    } catch (err) {
      console.error('Import failed', err);
      setError(err instanceof Error ? err.message : 'Import failed');
      setState('error');
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleContinue = () => {
    onComplete();
  };

  const handleBack = () => {
    setSource(null);
    setState('select');
    setBookmarks([]);
    setError(null);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Hidden file input for HTML upload
  const fileInput = (
    <input
      type="file"
      ref={fileInputRef}
      accept=".html,.htm"
      className="hidden"
      onChange={handleFileChange}
    />
  );

  // Source selection state
  if (state === 'select') {
    return (
      <div className="p-6 space-y-6 max-w-md mx-auto">
        {fileInput}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Import your bookmarks</h1>
          <p className="text-sm text-muted-foreground">
            Choose where to import from
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleSelectBrowser}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors"
          >
            <img src="/chromium.png" alt="" className="w-10 h-10" />
            <span className="text-sm font-medium">Current Browser</span>
            <span className="text-xs text-muted-foreground text-center">
              Import directly from Chrome, Arc, Brave
            </span>
          </button>

          <button
            onClick={handleSelectFile}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium">Upload File</span>
            <span className="text-xs text-muted-foreground text-center">
              Import HTML export from any browser
            </span>
          </button>
        </div>

        <Button variant="ghost" onClick={handleSkip} className="w-full">
          Skip for now
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          You can always import bookmarks later from Settings.
        </p>
      </div>
    );
  }

  // Loading state
  if (state === 'loading') {
    return (
      <div className="p-6 space-y-6 max-w-md mx-auto">
        {fileInput}
        <div className="text-center space-y-2">
          {source === 'browser' ? (
            <img src="/chromium.png" alt="" className="w-12 h-12 mx-auto mb-2" />
          ) : (
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <h1 className="text-xl font-semibold">
            {source === 'browser' ? 'Checking bookmarks...' : 'Parsing file...'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {source === 'browser'
              ? 'Looking for bookmarks to import.'
              : 'Reading your bookmark file.'}
          </p>
        </div>
      </div>
    );
  }

  // Empty state - no bookmarks found
  if (state === 'empty') {
    return (
      <div className="p-6 space-y-6 max-w-md mx-auto">
        {fileInput}
        <div className="text-center space-y-2">
          {source === 'browser' ? (
            <img src="/chromium.png" alt="" className="w-12 h-12 mx-auto mb-2" />
          ) : (
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <h1 className="text-xl font-semibold">No bookmarks found</h1>
          <p className="text-sm text-muted-foreground">
            {source === 'browser'
              ? 'No importable bookmarks were found in your browser.'
              : 'No bookmarks were found in the uploaded file.'}
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={handleBack} variant="outline" className="w-full">
            Try another source
          </Button>
          <Button onClick={handleSkip} className="w-full">
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="p-6 space-y-6 max-w-md mx-auto">
        {fileInput}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-2">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Import failed</h1>
          <p className="text-sm text-muted-foreground">
            {error || 'Something went wrong while importing bookmarks.'}
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={handleBack} variant="outline" className="w-full">
            Try again
          </Button>
          <Button onClick={handleSkip} className="w-full">
            Continue without importing
          </Button>
        </div>
      </div>
    );
  }

  // Importing state
  if (state === 'importing') {
    return (
      <div className="p-6 space-y-6 max-w-md mx-auto">
        {fileInput}
        <div className="text-center space-y-2">
          <div className="relative w-12 h-12 mx-auto mb-2">
            {source === 'browser' ? (
              <img src="/chromium.png" alt="" className="w-12 h-12" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Importing bookmarks...</h1>
          <p className="text-sm text-muted-foreground">
            Importing {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>
    );
  }

  // Done state
  if (state === 'done' && result) {
    return (
      <div className="p-6 space-y-6 max-w-md mx-auto">
        {fileInput}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h1 className="text-xl font-semibold">Import complete</h1>
          <p className="text-sm text-muted-foreground">
            Imported {result.imported} bookmark{result.imported !== 1 ? 's' : ''}
            {result.skipped > 0 && (
              <>, skipped {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''}</>
            )}
            .
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={handleContinue} className="w-full">
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Ready state - show bookmark count and import/skip buttons
  return (
    <div className="p-6 space-y-6 max-w-md mx-auto">
      {fileInput}
      <div className="text-center space-y-2">
        {source === 'browser' ? (
          <img src="/chromium.png" alt="" className="w-12 h-12 mx-auto mb-2" />
        ) : (
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <h1 className="text-xl font-semibold">Import bookmarks?</h1>
        <p className="text-sm text-muted-foreground">
          Found {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}. Would you like to import them to Jot?
        </p>
      </div>

      <div className="space-y-3">
        <Button onClick={handleImport} className="w-full">
          Import {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
        </Button>

        <Button variant="ghost" onClick={handleBack} className="w-full">
          Choose different source
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You can always import bookmarks later from Settings.
      </p>
    </div>
  );
}
