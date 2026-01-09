"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";

interface Profile {
  id: string;
  email: string;
  role: string;
  window_number: number | null;
  is_active: boolean;
}

export default function StaffManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: true })
      .order("window_number", { ascending: true });

    if (!error) {
      setProfiles(data || []);
    }
    setLoading(false);
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !currentStatus })
      .eq("id", id);
    
    if (!error) fetchProfiles();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-black text-blue-950 uppercase tracking-tighter">Personnel Management</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">LGU Staff & Window Assignments</p>
          </div>
          <div className="bg-blue-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg border-b-4 border-yellow-500">
            System Admin Access Only
          </div>
        </div>

        {/* TABLE CONTAINER */}
        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel Email</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role / Assignment</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Status</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {profiles.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="p-6">
                    <p className="text-sm font-bold text-slate-700">{user.email}</p>
                    <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-tighter italic">ID: {user.id.slice(0, 8)}...</p>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter shadow-sm ${
                        user.role === 'admin' 
                          ? 'bg-red-100 text-red-700' 
                          : user.role === 'master'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.role === 'admin' ? '🛡️ Admin' : user.role === 'master' ? '🔑 Master' : `🪟 Window ${user.window_number}`}
                      </span>
                      {user.window_number === 1 && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Screening</span>}
                      {user.window_number === 2 && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Payment</span>}
                      {user.window_number === 3 && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Releasing</span>}
                    </div>
                  </td>
                  <td className="p-6">
                    {user.is_active ? (
                      <span className="bg-green-100 text-green-700 text-[9px] font-black px-3 py-1 rounded-lg uppercase flex items-center w-fit gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        Active Access
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-3 py-1 rounded-lg uppercase flex items-center w-fit gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                        Deactivated
                      </span>
                    )}
                  </td>
                  <td className="p-6 text-right">
                    <button 
                      onClick={() => toggleStatus(user.id, user.is_active)}
                      className={`text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-sm ${
                        user.is_active 
                        ? 'bg-white border border-red-100 text-red-500 hover:bg-red-500 hover:text-white' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {user.is_active ? 'Revoke Access' : 'Grant Access'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="p-20 text-center">
              <p className="font-black text-blue-900 uppercase tracking-[0.3em] animate-pulse">Loading Personnel Directory...</p>
            </div>
          )}
        </div>

        {/* FOOTER ADVISORY */}
        <div className="mt-8 bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
           <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase tracking-tight">
             <span className="font-black">Security Protocol:</span> Access management affects live sessions. Deactivating a user will prevent them from calling tickets or accessing the command center during their next login attempt.
           </p>
        </div>

        <footer className="mt-16 opacity-30 text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.5em]">Municipality of Pililla HR Management Portal • 2026</p>
        </footer>
      </div>
    </div>
  );
}