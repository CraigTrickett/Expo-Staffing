import React, { useState } from 'react';
import { Lock, LogIn, Loader2, Shield } from 'lucide-react';
import { signInAdmin, sendAdminPasswordReset } from '@/lib/firebase';
import { toast } from '@/components/common/Toast';

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await signInAdmin(email, password);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Could not sign in.');
    }
    // On success, the auth state subscription elsewhere in the app picks
    // this up automatically and re-renders into the admin dashboard.
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email above first, then click "Forgot password?" again.');
      return;
    }
    const ok = await sendAdminPasswordReset(email);
    if (ok) {
      toast.success(`Password reset email sent to ${email}, if that account exists.`, 'Check Your Email');
    } else {
      toast.error('Could not send a reset email right now. Please try again.', 'Failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f3f6] flex items-center justify-center p-4 font-sans">
      <div className="max-w-sm w-full bg-white border border-[#d8dce0] rounded shadow-modus-2 p-8">
        <div className="w-12 h-12 rounded bg-[#e5f2f8] border border-[#b9dcf0] text-[#0063a3] flex items-center justify-center mx-auto mb-4">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-[#252a2e] text-center tracking-tight">Admin Sign In</h1>
        <p className="text-xs text-[#46535e] text-center mt-1 mb-6">
          Staff don't need to sign in — share their event's staff link directly.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-[#252a2e] mb-1.5">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3.5 py-2 text-sm text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-[#252a2e] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-[#7c878e] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded pl-9 pr-3.5 py-2 text-sm text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-[#da3832] bg-[#fdf2f2] border border-[#f5b5b3] rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring w-full py-2.5 bg-[#0063a3] hover:bg-[#005084] text-white rounded text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
          </button>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="focus-ring w-full text-center text-xs text-[#0063a3] hover:text-[#005084] font-semibold py-1 transition-colors cursor-pointer rounded"
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
};
