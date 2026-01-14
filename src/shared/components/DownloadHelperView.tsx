import { Download, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';

const DOWNLOAD_URL = 'https://github.com/alexanderjmontague/Jot/releases/latest/download/JotHelper.pkg';

interface DownloadHelperViewProps {
  onRetry?: () => void;
}

export function DownloadHelperView({ onRetry }: DownloadHelperViewProps) {
  const handleDownload = () => {
    window.open(DOWNLOAD_URL, '_blank');
  };

  return (
    <div className="p-6 space-y-6 max-w-md mx-auto">
      <div className="text-center space-y-2">
        <img src="/icon/128.png" alt="Jot" className="w-12 h-12 mb-2 mx-auto" />
        <h1 className="text-xl font-semibold">Install Jot Helper</h1>
        <p className="text-sm text-muted-foreground">
          Jot Helper is a tiny native app that lets Jot save comments to Obsidian or whatever local folder you specify.
        </p>
      </div>

      <div className="space-y-3">
        <Button onClick={handleDownload} className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Download for macOS
        </Button>

        {onRetry && (
          <Button variant="ghost" onClick={onRetry} className="w-full" size="sm">
            I've installed it
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      <div className="pt-4 border-t">
        <div className="text-xs text-muted-foreground space-y-2">
          <p className="font-medium">Installation steps:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0">1</span>
              <span>Download the .pkg file</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0">2</span>
              <span>Double-click to open (macOS will block it)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0">3</span>
              <span>Open <strong>System Settings → Privacy & Security</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0">4</span>
              <span>Scroll down and click <strong>"Open Anyway"</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0">5</span>
              <span>Come back here and click "I've installed it"</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
