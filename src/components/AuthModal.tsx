import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';

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
          setError(res.error || 'Failed to sign in');
        }
      } else {
        if (!name.trim()) {
          setError('Name is required');
          setIsSubmitting(false);
          return;
        }
        const res = await register(name, email, password);
        if (res.success) {
          onClose();
        } else {
          setError(res.error || 'Failed to create account');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl p-6">
        <DialogHeader className="text-left space-y-2">
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
            {mode === 'signin' ? 'Sign in to ApplicationTracker' : 'Create your account'}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            {mode === 'signin'
              ? 'Access your private job tracking workspace and synced applications.'
              : 'Start tracking job applications across LinkedIn, Internshala, and more.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {mode === 'signup' && (
            <div className="space-y-1">
              <Label htmlFor="auth-name" className="text-xs font-semibold uppercase text-slate-700">
                Full Name
              </Label>
              <Input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                className="h-10 rounded-lg border-slate-300"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="auth-email" className="text-xs font-semibold uppercase text-slate-700">
              Email Address
            </Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-10 rounded-lg border-slate-300"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="auth-password" className="text-xs font-semibold uppercase text-slate-700">
              Password
            </Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="h-10 rounded-lg border-slate-300"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg shadow-sm"
          >
            {isSubmitting ? (
              'Processing...'
            ) : mode === 'signin' ? (
              <span className="flex items-center justify-center gap-2">
                <LogIn className="w-4 h-4" /> Sign In
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" /> Create Account
              </span>
            )}
          </Button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100 text-sm text-slate-600">
          {mode === 'signin' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="font-semibold text-blue-600 hover:underline"
              >
                Sign up
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
                className="font-semibold text-blue-600 hover:underline"
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
