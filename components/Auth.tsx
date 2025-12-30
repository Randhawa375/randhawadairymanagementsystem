
import React, { useState } from 'react';
import { User, Milk, Lock, UserPlus, LogIn, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType } from '../types';

interface AuthProps {
  onLogin: (user: any) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    // Format email correctly if user only enters a username-like string
    const emailToUse = email.includes('@') ? email : `${email}@randhawafarm.com`;

    try {
      if (isLogin) {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: password,
        });

        if (loginError) throw loginError;
        if (data.user) {
          onLogin(data.user);
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: emailToUse,
          password: password,
          options: {
            data: {
              farm_name: 'Randhawa Dairy Animal Management System',
            }
          }
        });

        if (signUpError) throw signUpError;
        
        setSuccessMessage('Account created successfully! You can now log in.');
        setTimeout(() => {
          setIsLogin(true);
          setLoading(false);
        }, 1500);
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border-4 border-slate-900 overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="p-8 text-center border-b-2 border-slate-100 bg-slate-50">
          <div className="inline-flex p-4 bg-indigo-600 rounded-3xl text-white mb-4 shadow-lg">
            <Milk size={40} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-tight">
            Randhawa Dairy<br/>Animal Management System
          </h1>
        </div>

        <div className="p-8">
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-8 border border-slate-200">
            <button 
              type="button"
              disabled={loading}
              onClick={() => { setIsLogin(true); setError(''); setSuccessMessage(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${isLogin ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400'}`}
            >
              <LogIn size={16} /> Login
            </button>
            <button 
              type="button"
              disabled={loading}
              onClick={() => { setIsLogin(false); setError(''); setSuccessMessage(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${!isLogin ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400'}`}
            >
              <UserPlus size={16} /> Signup
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-600 font-bold text-xs text-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-emerald-600 font-bold text-xs text-center flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                <CheckCircle2 size={16} />
                {successMessage}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Username or Email (صارف نام)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-4 rounded-xl outline-none border-2 border-slate-200 focus:border-indigo-600 font-bold text-slate-900"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Password (پاس ورڈ)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-4 rounded-xl outline-none border-2 border-slate-200 focus:border-indigo-600 font-bold text-slate-900"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3 border-b-4 border-slate-700 active:translate-y-1 active:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : (isLogin ? <LogIn size={20} /> : <UserPlus size={20} />)}
              {loading ? 'Processing...' : (isLogin ? 'Access System' : 'Create Account')}
            </button>
          </form>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            RANDHAWA DAIRY ANIMAL MANAGEMENT
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
