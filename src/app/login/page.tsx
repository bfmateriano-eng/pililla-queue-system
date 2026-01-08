"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setErrorMsg(authError.message);
      setLoading(false);
      return;
    }

    // 2. Fetch the user's profile to check role
    const { data: profile, error: profError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profError || !profile) {
      // DEBUG LOG: Tells us why it failed
      console.error("Profile Fetch Error:", profError);
      setErrorMsg(`Profile missing for ${email}. Please run the SQL fix in Step 142.`);
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // 3. Redirect based on role
    if (profile.role === "admin") {
      router.push("/dashboard/admin");
    } else {
      router.push("/dashboard/staff");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img src="/lgu-logo.png" alt="Pililla Logo" className="w-24 h-24 mx-auto mb-4" />
          <h1 className="text-white text-3xl font-black uppercase tracking-tighter italic">Pililla Queue</h1>
          <p className="text-blue-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">Staff & Admin Portal</p>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
          
          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center leading-relaxed">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest ml-1">Official Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-5 bg-slate-950 border border-slate-800 rounded-2xl text-white font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="email@pililla.gov.ph"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest ml-1">Access Key</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-5 bg-slate-950 border border-slate-800 rounded-2xl text-white font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl active:scale-95 disabled:bg-slate-800 disabled:text-slate-600"
            >
              {loading ? "Authenticating..." : "Sign In to Dashboard"}
            </button>
          </form>
        </div>

        <div className="mt-12 flex flex-col items-center opacity-30">
           <img src="/better-pililla.png" alt="Brand" className="h-6 grayscale mb-2" />
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Government Internal System</p>
        </div>
      </div>
    </div>
  );
}