import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, register } = useAuth();

  useEffect(() => {
    setMode(defaultMode);
    setError(null);
  }, [defaultMode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const res = await login(email, password);
        if (res.success) {
          onClose();
        } else {
          setError(res.error || 'Invalid email or password');
        }
      } else {
        if (name.trim().length < 2) {
          setError('Name must be at least 2 characters');
          setIsSubmitting(false);
          return;
        }
        const res = await register(name, email, password);
        if (res.success) {
          onClose();
        } else {
          setError(res.error || 'Could not create account');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[hsl(var(--surface-card))] border border-[var(--hairline-strong)] shadow-[var(--shadow-float)] rounded-[14px] p-6">
        <DialogHeader className="text-left space-y-1.5">
          <DialogTitle className="text-[18px] font-medium tracking-[-0.01em] text-[hsl(var(--ink-primary))]">
            {mode === 'signin' ? 'Sign in to ApplicationTracker' : 'Create your account'}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[hsl(var(--ink-secondary))]">
            {mode === 'signin'
              ? 'Access your synced applications, interviews, and Chrome extension key.'
              : 'Sync applications across your browser and desktop workspace.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-[13px] text-[hsl(var(--semantic-danger))] bg-[hsl(var(--semantic-danger-bg))] border border-[rgba(185,28,28,0.2)] rounded-[8px]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-name" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Full name
              </Label>
              <Input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                className="h-9 rounded-[8px]"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="auth-email" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
              Email address
            </Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-9 rounded-[8px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
              Password
            </Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
              minLength={6}
              className="h-9 rounded-[8px]"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] font-medium text-[13px] rounded-[8px]"
          >
            {isSubmitting
              ? 'Working...'
              : mode === 'signin'
              ? 'Sign in'
              : 'Create account'}
          </Button>
        </form>

        <div className="text-center pt-3 border-t border-[var(--hairline)] text-[13px] text-[hsl(var(--ink-secondary))]">
          {mode === 'signin' ? (
            <p>
              No account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="font-medium text-[hsl(var(--accent-ink))] hover:underline"
              >
                Create one
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="font-medium text-[hsl(var(--accent-ink))] hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
