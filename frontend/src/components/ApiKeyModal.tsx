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
        title: "API Key Copied!",
        description: "Paste this key into your Chrome Extension settings to sync applications.",
      });
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleRegenerate = async () => {
    if (window.confirm("Are you sure? Any Chrome Extension using the old key will need to be updated.")) {
      setIsRegenerating(true);
      try {
        const newKey = await regenerateApiKey();
        if (newKey) {
          toast({
            title: "API Key Regenerated",
            description: "Your new API key has been created. Remember to update your Chrome Extension.",
          });
        }
      } finally {
        setIsRegenerating(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white border border-slate-200 shadow-xl rounded-2xl p-6">
        <DialogHeader className="text-left space-y-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-1">
            <Key className="w-5 h-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
            Chrome Extension API Key
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Connect your JobTracker Assistant Chrome Extension to securely sync applications to your personal dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-slate-700">
              Your Personal API Key
            </Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={user?.apiKey || 'No key generated'}
                className="font-mono text-xs bg-slate-50 border-slate-300 text-slate-800"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                className="flex-shrink-0 gap-1.5 border-slate-300 hover:bg-slate-100"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">How to connect your Chrome Extension:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-600">
              <li>Click the <strong>JobTracker Assistant</strong> icon in your Chrome toolbar.</li>
              <li>Click the <strong>⚙️ Settings</strong> button in the top right.</li>
              <li>Paste your API Key and click <strong>Save</strong>.</li>
            </ol>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="text-xs text-slate-500 hover:text-red-600 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            Regenerate Key
          </Button>

          <Button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm px-4"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
