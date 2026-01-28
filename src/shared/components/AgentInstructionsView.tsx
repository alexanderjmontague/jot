import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Settings, Copy, Check } from 'lucide-react';

interface AgentInstructionsViewProps {
  folderPath: string; // Full path like "/Users/you/Documents/Jot"
  onComplete: () => void;
}

export function AgentInstructionsView({ folderPath, onComplete }: AgentInstructionsViewProps) {
  const [copied, setCopied] = useState(false);

  const getAgentInstructions = () => {
    if (!folderPath) return '';
    return `## Jot Bookmarks

Bookmarks are stored at: \`${folderPath}/bookmarks.md\`

To search bookmarks: \`grep -i "keyword" "${folderPath}/bookmarks.md"\`

Format: Folders are markdown headings (## Folder), bookmarks are \`- **[Title](url)** — Date\`, comments are \`  > text\`.`;
  };

  const handleCopy = async () => {
    const instructions = getAgentInstructions();
    if (!instructions) return;
    try {
      await navigator.clipboard.writeText(instructions);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-md mx-auto">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Settings className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Set up AI access</h1>
        <p className="text-sm text-muted-foreground">
          Add this to your CLAUDE.md or agent config so AI can find your bookmarks.
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all pr-10">
            {getAgentInstructions()}
          </pre>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <Button onClick={onComplete} className="w-full">
          Continue
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You can access this again in Settings.
      </p>
    </div>
  );
}
