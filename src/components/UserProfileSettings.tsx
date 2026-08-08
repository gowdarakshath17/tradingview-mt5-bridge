import React, { useState, useEffect } from 'react';
import { User, Phone, Save, KeyRound, Lock, Check, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { setUserEmailPassword } from '../lib/firebase';
import { UserProfile } from '../types';

interface UserProfileSettingsProps {
  profile: UserProfile;
  configPassphrase?: string;
  onUpdateProfile: (data: { firstName: string; lastName: string; phoneNumber: string; passphrase?: string }) => Promise<void>;
}

export default function UserProfileSettings({ profile, configPassphrase, onUpdateProfile }: UserProfileSettingsProps) {
  const [firstName, setFirstName] = useState(profile.firstName || '');
  const [lastName, setLastName] = useState(profile.lastName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber || '');
  const [passphrase, setPassphrase] = useState(profile.passphrase || configPassphrase || '');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync state whenever profile or configPassphrase updates
  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setPhoneNumber(profile.phoneNumber || '');
      const currentPass = profile.passphrase || configPassphrase || '';
      if (currentPass) {
        setPassphrase(currentPass);
      }
    }
  }, [profile, configPassphrase]);

  // VPS Password state
  const [vpsPassword, setVpsPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onUpdateProfile({ 
        firstName, 
        lastName, 
        phoneNumber, 
        passphrase: passphrase.trim() 
      });
      toast.success('Profile & Security Passphrase saved successfully!');
    } catch (error: any) {
      console.error("Profile update submit error:", error);
      const msg = error?.message || String(error);
      toast.error(`Failed to update profile: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetVpsPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vpsPassword || vpsPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    setSettingPassword(true);
    setPasswordSaved(false);
    try {
      await setUserEmailPassword(vpsPassword);
      toast.success("Password attached to your account! You can now sign in on VPS using email & password.");
      setPasswordSaved(true);
      setVpsPassword('');
      setTimeout(() => setPasswordSaved(false), 4000);
    } catch (err: any) {
      toast.error(`Failed to set password: ${err?.message || String(err)}`);
    } finally {
      setSettingPassword(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-200 bg-white">
        <h3 className="font-semibold text-slate-900">Profile Settings</h3>
        <p className="text-xs text-slate-400 mt-0.5">Manage your personal information.</p>
      </div>
      
      <div className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                First Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors font-sans"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Last Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors font-sans"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                required
                pattern="^\+?[0-9\s\-\(\)]+$"
                title="Please enter a valid phone number format"
                placeholder="+1 (555) 019-2834"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                disabled
                value={profile.email}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-500 cursor-not-allowed font-sans font-medium"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Email linked to account and saved in cloud database.</p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Bridge Security Passphrase</span>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Linked to {profile.email}
              </span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassphrase ? "text" : "password"}
                required
                placeholder="Enter secret passphrase..."
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showPassphrase ? "Hide passphrase" : "Show passphrase"}
              >
                {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Required by TradingView alerts (<code className="font-mono text-blue-600 bg-slate-100 px-1 rounded">"passphrase": "{passphrase || 'your_key'}"</code>) and MT5 EA input <code className="font-mono text-blue-600 bg-slate-100 px-1 rounded">InpPassphrase</code>.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white font-sans text-xs font-semibold py-2.5 px-5 rounded-lg cursor-pointer transition-all shadow-lg active:scale-[0.99] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>

        {/* VPS Direct Login Password Card */}
        <div className="mt-8 pt-6 border-t border-slate-200/80 max-w-lg">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Set Password for VPS Login</h4>
          </div>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            If you originally logged in using Google OAuth on your browser, set an email password below so you can sign in with <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[11px]">{profile.email}</code> on your Windows VPS!
          </p>
          <form onSubmit={handleSetVpsPassword} className="flex gap-2">
            <div className="relative flex-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Create password for VPS sign in..."
                value={vpsPassword}
                onChange={(e) => setVpsPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={settingPassword}
              className={`px-4 py-2 rounded-xl text-xs font-semibold font-sans flex items-center gap-1.5 shrink-0 cursor-pointer transition-all shadow-sm active:scale-95 text-white ${
                passwordSaved ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {passwordSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Linked!</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{settingPassword ? 'Linking...' : 'Set Password'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
