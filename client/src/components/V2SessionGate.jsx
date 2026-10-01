import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Database, LogIn } from 'lucide-react';
import { v2Auth, setV2Token } from '../services/v2.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Gate for v2 (Postgres) pages. Uses the v1 identity to offer one-click
 * connect; falls back to explicit email/password when the PG account
 * does not exist yet (pre-migration).
 */
const V2SessionGate = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState('checking'); // checking | ready | login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    v2Auth
      .me()
      .then(() => {
        if (mounted) setStatus('ready');
      })
      .catch(() => {
        if (!mounted) return;
        setEmail(user?.email || '');
        setStatus('login');
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  const connect = async (mode) => {
    if (!email || !password) {
      toast.error('Email and password are required.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await v2Auth.register({ name: user?.name || email.split('@')[0], email, password });
      } else {
        await v2Auth.login({ email, password });
      }
      setStatus('ready');
      toast.success('Connected to PrioSync v2 engine.');
    } catch (e) {
      setV2Token(null);
      toast.error(e?.response?.data?.message || 'v2 sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#2B1B17]/20 border-t-[#FC703C] animate-spin" />
          <p className="text-sm text-[#2B1B17]/50 font-medium">Connecting to v2 engine…</p>
        </div>
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <div className="max-w-md mx-auto mt-10 bg-[#2B1B17] rounded-3xl p-8 text-white border border-[#FC703C]/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-[#FC703C]/20">
            <Database size={20} className="text-[#FC703C]" />
          </div>
          <h2 className="text-xl font-black">Connect v2 engine</h2>
        </div>
        <p className="text-sm text-white/60 mb-6 leading-relaxed">
          Planner and Focus run on the new Postgres engine, which keeps a separate session during
          migration. Sign in with the same credentials (or register — same email works).
        </p>
        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl bg-[#231612] border border-white/10 text-white placeholder:text-white/30 focus:border-[#FC703C] outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl bg-[#231612] border border-white/10 text-white placeholder:text-white/30 focus:border-[#FC703C] outline-none"
          />
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => connect('login')}
              disabled={busy}
              className="flex-1 py-3 bg-[#FC703C] text-[#2B1B17] font-black rounded-xl hover:bg-[#ff855c] transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <LogIn size={16} /> {busy ? 'Working…' : 'Sign in'}
            </button>
            <button
              onClick={() => connect('register')}
              disabled={busy}
              className="flex-1 py-3 bg-white/10 text-white font-black rounded-xl hover:bg-white/15 transition-all disabled:opacity-60"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default V2SessionGate;
