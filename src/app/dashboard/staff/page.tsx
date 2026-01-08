"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

export default function StaffWindow() {
  const [profile, setProfile] = useState<any>(null);
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUser();
    
    // Set up real-time subscription for this specific window's queue
    const channel = supabase
      .channel("staff-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        if (profile?.window_number) fetchQueueStatus(profile.window_number);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.window_number]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/login");

    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (prof) {
      setProfile(prof);
      if (prof.window_number) {
        fetchQueueStatus(prof.window_number);
      }
    }
    setLoading(false);
  }

  async function fetchQueueStatus(winNum: number) {
    if (!winNum) return;

    // Filter tickets waiting specifically for THIS window
    const { count } = await supabase
      .from("tickets")
      .select("*", { count: 'exact', head: true })
      .eq("status", "waiting")
      .eq("current_window", winNum);

    // Get ticket currently being served at this window
    const { data: serving } = await supabase
      .from("tickets")
      .select("*")
      .eq("status", "serving")
      .eq("current_window", winNum)
      .maybeSingle();

    setWaitingCount(count || 0);
    setCurrentTicket(serving || null);
  }

  async function callNext() {
    if (!profile || !profile.window_number) return;

    // Fetch the oldest ticket (Priority first) waiting for this window
    const { data: nextTicket } = await supabase
      .from("tickets")
      .select("*")
      .eq("status", "waiting")
      .eq("current_window", profile.window_number)
      .order("is_priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextTicket) return;

    // Mark as serving
    await supabase.from("tickets").update({ 
      status: "serving", 
      called_at: new Date().toISOString() 
    }).eq("id", nextTicket.id);
  }

  async function handleComplete() {
    if (!currentTicket || !profile) return;
    
    // Sequential Flow: 1 -> 2 -> 3 -> Done
    const nextWindowNum = profile.window_number < 3 ? profile.window_number + 1 : null;
    const nextStatus = nextWindowNum ? "waiting" : "done";

    await supabase.from("tickets").update({ 
      status: nextStatus,
      current_window: nextWindowNum || profile.window_number,
      completed_at: nextStatus === "done" ? new Date().toISOString() : null
    }).eq("id", currentTicket.id);

    setCurrentTicket(null);
  }

  async function returnToQueue() {
    if (!currentTicket) return;
    // Revert to 'waiting' for the same window
    await supabase.from("tickets").update({ status: "waiting" }).eq("id", currentTicket.id);
    setCurrentTicket(null);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-900"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 md:p-10">
      <div className="max-w-5xl mx-auto">
        
        {/* Top Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-5">
            <img src="/lgu-logo.png" className="w-20 h-20 drop-shadow-md" alt="Pililla Logo" />
            <div>
              <h1 className="text-3xl font-black text-blue-950 uppercase tracking-tighter leading-none">
                {profile?.window_number ? `Window ${profile.window_number}` : "Staff Access"}
              </h1>
              <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-1">
                {profile?.window_number === 1 && "Verification & Screening"}
                {profile?.window_number === 2 && "Order of Payment"}
                {profile?.window_number === 3 && "Releasing"}
                {!profile?.window_number && "No Assignment"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Queue Density</p>
                <p className="text-2xl font-black text-blue-950 leading-none">{waitingCount} <span className="text-xs text-slate-500">Waiting</span></p>
             </div>
             <div className="h-10 w-[2px] bg-slate-100 mx-2"></div>
             <img src="/better-pililla.png" className="h-8 grayscale opacity-50" alt="Brand" />
          </div>
        </header>

        {/* Main Interaction Area */}
        <div className="grid grid-cols-1 gap-8">
          
          {/* Status Display Card */}
          <div className="bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-slate-200 relative">
            <div className="p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
              
              {currentTicket ? (
                <div className="animate-in fade-in zoom-in duration-500 w-full max-w-lg">
                  <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 font-black uppercase text-[10px] px-4 py-2 rounded-full tracking-widest mb-6">
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                    Now Serving
                  </div>
                  
                  <h2 className="text-[12rem] font-black leading-none text-slate-900 tracking-tighter mb-4 drop-shadow-sm">
                    #{currentTicket.ticket_number}
                  </h2>
                  
                  <p className="text-3xl font-bold text-slate-600 uppercase tracking-tight mb-12">
                    {currentTicket.client_name}
                  </p>
                  
                  {currentTicket.is_priority && (
                    <div className="mb-8 inline-block bg-orange-100 text-orange-700 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest border border-orange-200">
                      ⚠️ Priority Account
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <button 
                      onClick={handleComplete} 
                      className="bg-green-600 hover:bg-green-700 text-white p-8 rounded-3xl font-black text-xl shadow-xl transition-all hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center"
                    >
                      <span className="text-xs opacity-70 mb-1 uppercase tracking-widest">Process Done</span>
                      {profile.window_number < 3 ? `PASS TO WIN ${profile.window_number + 1}` : "COMPLETE"}
                    </button>
                    
                    <button 
                      onClick={returnToQueue} 
                      className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-8 rounded-3xl font-black text-xl transition-all active:scale-95 flex flex-col items-center justify-center"
                    >
                      <span className="text-xs opacity-70 mb-1 uppercase tracking-widest">Incomplete</span>
                      RE-QUEUE
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 border border-slate-100">
                    <span className="text-4xl">🕒</span>
                  </div>
                  <h2 className="text-6xl font-black text-slate-200 uppercase tracking-tighter mb-10 italic">Window Ready</h2>
                  
                  <button 
                    onClick={callNext} 
                    disabled={waitingCount === 0 || !profile?.window_number}
                    className={`px-16 py-8 rounded-[2.5rem] font-black text-3xl shadow-2xl transition-all active:scale-95 ${
                      waitingCount > 0 && profile?.window_number 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white hover:-translate-y-1 animate-in slide-in-from-bottom-5' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {waitingCount > 0 ? "CALL NEXT CITIZEN" : "QUEUE EMPTY"}
                  </button>
                  
                  {waitingCount > 0 && (
                    <p className="mt-6 text-blue-500 font-bold uppercase text-[10px] tracking-[0.3em] animate-pulse">
                      New Citizens are waiting in line
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Area */}
        <footer className="mt-12 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-slate-200 pt-8">
           <button 
            onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
            className="group flex items-center gap-2 text-slate-400 font-black hover:text-red-600 transition-colors text-[10px] uppercase tracking-widest"
          >
            <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> Logout Staff Session
          </button>
          
          <div className="text-center md:text-right">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Municipality of Pililla</p>
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Queue Management System v1.0</p>
          </div>
        </footer>
      </div>
    </div>
  );
}