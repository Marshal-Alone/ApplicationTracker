import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { Key, Copy, Check, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const { user, regenerateApiKey } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      setCopied(true);
      toast({
        title: 'API key copied',
        description: 'Paste it inside Chrome Extension Settings to sync captured jobs',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    if (window.confirm('Regenerating revokes the previous key. Continue?')) {
      setIsRegenerating(true);
      try {
        const newKey = await regenerateApiKey();
        if (newKey) {
          toast({
            title: 'API key regenerated',
            description: 'Update the key stored in your Chrome extension',
          });
        }
      } finally {
        setIsRegenerating(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-[hsl(var(--surface-card))] border border-[var(--hairline-strong)] shadow-[var(--shadow-float)] rounded-[14px] p-6">
        <DialogHeader className="text-left space-y-1.5">
          <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-tint)] border border-[rgba(27,74,214,0.18)] flex items-center justify-center text-[hsl(var(--accent-ink))] mb-1">
            <Key className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <DialogTitle className="text-[18px] font-medium tracking-[-0.01em] text-[hsl(var(--ink-primary))]">
            Chrome extension key
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[hsl(var(--ink-secondary))]">
            Authenticate the browser extension so captured job postings save to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-1">
          <div className="space-y-1.5">
            <Label htmlFor="personal-api-key" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
              Personal API key
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="personal-api-key"
                readOnly
                value={user?.apiKey || 'No key generated'}
                className="font-mono-num text-[12px] h-9 bg-[hsl(var(--surface-raised))] border-[var(--hairline-strong)] text-[hsl(var(--ink-primary))] rounded-[8px]"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                className="flex-shrink-0 h-9 px-3 gap-1.5 rounded-[8px] border-[var(--hairline-strong)]"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[hsl(var(--semantic-positive))]" strokeWidth={1.5} />
                ) : (
                  <Copy className="w-4 h-4 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="bg-[hsl(var(--surface-page))] border border-[var(--hairline)] rounded-[10px] p-4 text-[13px] text-[hsl(var(--ink-secondary))] space-y-2">
            <p className="font-medium text-[hsl(var(--ink-primary))]">Setup instructions</p>
            <ol className="list-decimal list-inside space-y-1 text-[hsl(var(--ink-secondary))]">
              <li>Open ApplicationTracker Assistant from the Chrome toolbar.</li>
              <li>Open Settings from the top-right gear button.</li>
              <li>Paste your API key, verify server URL, and save.</li>
            </ol>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--hairline)]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="text-[12px] text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--semantic-danger))] gap-1.5 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            Regenerate key
          </Button>

          <Button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] text-[13px] font-medium"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
