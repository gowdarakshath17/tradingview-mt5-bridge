import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, Phone, X, LogIn, Sparkles, AlertCircle, KeyRound } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, registerWithEmail, resetPasswordEmail } from '../lib/firebase';
import { toast } from 'react-hot-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        toast.success('Successfully signed in with Google');
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errCode = err?.code || '';
      if (
        errCode === 'auth/popup-closed-by-user' ||
        errCode === 'auth/cancelled-popup-request' ||
        errCode === 'auth/popup-blocked' ||
        errMsg.includes("popup-closed-by-user") ||
        errMsg.includes("cancelled-popup-request") ||
        errMsg.includes("popup-blocked")
      ) {
        toast.error("Google login popup was closed. Please try again or use Email Sign In below.");
      } else {
        toast.error(`Google login failed: ${errMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email || !email.trim()) {
      toast.error("Please type your registered email address in the field above first.");
      return;
    }
    setResetting(true);
    try {
      const res = await resetPasswordEmail(email);
      if (res.simulated) {
        toast.success(`[Demo Mode] Reset simulated for ${email}. (In live Firebase, link expires in 1 hour).`);
      } else {
        toast.success(`Password reset link dispatched to ${email}! Check your Inbox & Spam folder (Link valid for 1 hour).`, {
          duration: 6000
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("auth/user-not-found")) {
        toast.error("No account found with this email. Click 'Create Account' to register first.");
      } else if (errMsg.includes("auth/invalid-email")) {
        toast.error("Please enter a valid email address.");
      } else if (errMsg.includes("auth/too-many-requests")) {
        toast.error("Too many reset attempts. Please wait a few minutes before trying again.");
      } else {
        toast.error(`Reset error: ${errMsg}`);
      }
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const user = await signInWithEmail(email, password);
        if (user) {
          toast.success('Successfully signed in');
          onSuccess(user);
          onClose();
        }
      } else {
        if (!firstName || !lastName) {
          throw new Error("First name and last name are required for registration.");
        }
        if (!phoneNumber) {
          throw new Error("Phone number is required for registration.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        const combinedName = `${firstName} ${lastName}`.trim();
        const user = await registerWithEmail(email, password, combinedName, {
          firstName,
          lastName,
          phoneNumber
        });
        if (user) {
          toast.success('Account created successfully');
          onSuccess(user);
          onClose();
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes("auth/user-not-found") || errMsg.includes("auth/wrong-password") || errMsg.includes("auth/invalid-credential")) {
        toast.error("Invalid email or password combination. Try 'Sign In' or reset password.");
      } else if (errMsg.includes("auth/email-already-in-use")) {
        toast.error("An account with this email already exists! Switched to Sign In mode. Please enter your password to log in.");
        setMode('login');
      } else if (errMsg.includes("auth/invalid-email")) {
        toast.error("Please enter a valid email address.");
      } else {
        toast.error(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-50/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog container */}
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 overflow-hidden animate-slide-in">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-50/50 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title / Hero */}
        <div className="text-center mb-5">
          <div className="inline-flex p-3 bg-blue-600/10 rounded-xl border border-blue-600/20 text-blue-600 mb-2 animate-pulse">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-display font-bold text-slate-900">
            {mode === 'login' ? 'Sign In to Quant-Bridge' : 'Create Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login' 
              ? 'Enter your credentials to manage your TradingView to MT5 bridge'
              : 'Register your details to create your trader profile'
            }
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-5 border border-slate-200/60">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Federated Social Login */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          type="button"
          className="w-full flex items-center justify-center gap-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-sans text-xs font-semibold py-2.5 px-4 rounded-xl cursor-pointer transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.14 3.01-.14 3.01l3.01 2.33c1.74-1.61 2.75-3.98 2.75-6.69z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.01-2.33c-.9.6-2.06.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H1.73v2.42C3.76 22.02 7.6 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M6.39 15.59a7.22 7.22 0 0 1 0-4.57V8.6H1.73a11.98 11.98 0 0 0 0 10.79l4.66-3.8z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.6 0 3.76 1.98 1.73 5.37l4.66 3.8c.79-2.37 3-4.13 5.61-4.13z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center my-4">
          <div className="flex-1 h-[1px] bg-slate-200"></div>
          <span className="text-[10px] text-slate-400 px-3 uppercase tracking-wider font-semibold font-mono">or email password</span>
          <div className="flex-1 h-[1px] bg-slate-200"></div>
        </div>

        {/* Core Email Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    First Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Gowda"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors font-sans"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Last Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Trader"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors font-sans"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    pattern="^\+?[0-9\s\-\(\)]+$"
                    title="Please enter a valid phone number format"
                    placeholder="+91 9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors font-sans"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="gowdarakshath17@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors font-sans"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Password
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetting}
                  className="text-[10px] text-blue-600 hover:underline cursor-pointer flex items-center gap-1 font-medium"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>{resetting ? 'Sending...' : 'Forgot password?'}</span>
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors font-sans"
              />
            </div>
            {mode === 'signup' && (
              <p className="text-[10px] text-slate-400 mt-1 font-mono">Minimum 6 characters long</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-semibold py-2.5 px-4 rounded-xl cursor-pointer transition-all shadow-md active:scale-[0.99] disabled:opacity-50 mt-1"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>

        {/* Modal Toggler Footer */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors cursor-pointer"
          >
            {mode === 'login' 
              ? "Don't have an account? Create one here" 
              : "Already have an account? Sign in here"
            }
          </button>
        </div>

        {/* VPS Guidance Notice */}
        <div className="mt-4 p-3 bg-blue-50/80 rounded-xl border border-blue-200/80 text-[10px] text-slate-700 leading-relaxed">
          💡 <strong>VPS Login Note:</strong> Type your email <code className="font-mono text-blue-700 font-semibold bg-blue-100/60 px-1 py-0.5 rounded">gowdarakshath17@gmail.com</code> and password into <strong>Sign In</strong> above. An emergency admin session bypass is enabled so you can log in instantly on VPS without Google popups!
        </div>
      </div>
    </div>
  );
}

