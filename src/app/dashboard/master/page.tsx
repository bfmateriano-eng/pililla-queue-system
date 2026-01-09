"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

// --- Types ---
interface Profile {
  id: string;
  role: string;
  window_number: number;
}

interface Ticket {
  id: string;
  ticket_number: string;
  client_name: string;
  status: 'waiting' | 'serving' | 'done' | 'pending';
  current_window: number;
  is_priority: boolean;
  remarks?: string;
  created_at: string;
  serving_started_at?: string;
  hold_started_at?: string;
  total_hold_seconds?: number;
  w1_wait_start?: string;
  w2_wait_start?: string;
  w3_wait_start?: string;
}

export default function MasterStaffPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeWindow, setActiveWindow] = useState<number>(1); 
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [waitingQueue, setWaitingQueue] = useState<Ticket[]>([]);
  const [pendingPool, setPendingPool] = useState<Ticket[]>([]); 
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(async (winNum: number) => {
    const { data: serving } = await supabase.from("tickets")
      .select("*").eq("status", "serving").eq("current_window", winNum);

    const { data: waiting } = await supabase.from("tickets")
      .select("*").eq("status", "waiting").eq("current_window", winNum)
      .order("is_priority", { ascending: false }).order("created_at", { ascending: true });

    const { data: pending } = await supabase.from("tickets")
      .select("*").eq("status", "pending").order("created_at", { ascending: false });

    setActiveTickets(serving || []);
    setWaitingQueue(waiting || []);
    setPendingPool(pending || []);
  }, []);

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (prof && prof.role === 'master') {
        setProfile(prof as Profile);
        await fetchData(activeWindow);
      } else {
        router.push("/dashboard/staff");
      }
      setLoading(false);
    }
    checkUser();

    const channel = supabase.channel("master-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        fetchData(activeWindow);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeWindow, fetchData, router]);

  async function callTicket(ticketId?: string) {
    if (!profile) return;
    const now = new Date();
    let targetId = ticketId;
    
    if (!targetId && waitingQueue.length > 0) targetId = waitingQueue[0].id;

    if (targetId) {
      const ticket = [...waitingQueue, ...activeTickets, ...pendingPool].find(t => t.id === targetId);
      let updateData: any = { 
        status: "serving", 
        current_window: activeWindow,
        serving_started_at: now.toISOString(),
        called_at: now.toISOString()
      };

      const waitStartKey = `w${activeWindow}_wait_start` as keyof Ticket;
      if (ticket && ticket[waitStartKey]) {
        const waitSecs = Math.floor((now.getTime() - new Date(ticket[waitStartKey] as string).getTime()) / 1000);
        updateData[`w${activeWindow}_waiting_seconds`] = waitSecs;
      }

      if (ticket?.status === 'pending' && ticket.hold_started_at) {
        const holdSecs = Math.floor((now.getTime() - new Date(ticket.hold_started_at).getTime()) / 1000);
        updateData.total_hold_seconds = (ticket.total_hold_seconds || 0) + holdSecs;
        updateData.hold_started_at = null; 
      }

      await supabase.from("tickets").update(updateData).eq("id", targetId);
    }
  }

  async function handleAction(ticket: Ticket, action: 'pass' | 'hold' | 'done') {
    const now = new Date();
    let elapsedSecs = 0;
    if (ticket.serving_started_at) {
      elapsedSecs = Math.floor((now.getTime() - new Date(ticket.serving_started_at).getTime()) / 1000);
    }

    let updateData: any = {
      [`w${activeWindow}_serving_seconds`]: elapsedSecs,
    };

    if (action === 'hold') {
      const note = prompt("Reason for Hold (Missing Docs):", ticket.remarks || "");
      if (note === null) return;
      updateData.status = "pending";
      updateData.remarks = note || "Lacking Requirements";
      updateData.hold_started_at = now.toISOString(); 
    } else {
      const nextWin = activeWindow < 3 ? activeWindow + 1 : null;
      const nextStatus = (action === 'done' || !nextWin) ? "done" : "waiting";
      
      updateData.status = nextStatus;
      updateData.current_window = nextWin || activeWindow;
      updateData.remarks = null;

      if (nextWin) {
        updateData[`w${nextWin}_wait_start`] = now.toISOString();
      }
      
      if (nextStatus === "done") {
        updateData.completed_at = now.toISOString();
      }
    }

    await supabase.from("tickets").update(updateData).eq("id", ticket.id);
  }

  if (loading) return <div className="p-10 font-black text-blue-900 uppercase text-center">Master Access Authorized...</div>;

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans text-slate-900 overflow-hidden">
      
      {/* 1. TOP HEADER & NAVIGATION */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
        <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <img src="/lgu-logo.png" className="w-14 h-14" alt="Pililla Logo" />
            <div>
              <h1 className="text-xl font-black uppercase text-blue-950">Master Control Panel</h1>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Unified LGU Management</p>
            </div>
          </div>

          <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                onClick={() => setActiveWindow(num)}
                className={`py-2 px-6 rounded-xl font-black text-[10px] uppercase transition-all ${
                  activeWindow === num ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Window {num}
              </button>
            ))}
          </div>

          <button 
            onClick={() => callTicket()} 
            disabled={waitingQueue.length === 0} 
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-sm shadow-xl hover:bg-blue-700 disabled:bg-slate-300 transition-transform active:scale-95"
          >
            CALL NEXT CITIZEN ({waitingQueue.length})
          </button>
        </div>
      </div>

      {/* 2. THREE-COLUMN WORKSPACE */}
      <main className="flex-grow overflow-hidden p-6">
        <div className="max-w-[1800px] mx-auto h-full grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMN 1: ACTIVE SERVING */}
          <section className="flex flex-col h-full overflow-hidden">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Active Counter (Win {activeWindow})</h2>
            <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {activeTickets.length === 0 ? (
                <div className="bg-white/50 border-4 border-dashed border-slate-200 rounded-[3rem] p-12 text-center text-slate-300 font-black italic uppercase">Idle</div>
              ) : (
                activeTickets.map(t => (
                  <div key={t.id} className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col gap-6 animate-in slide-in-from-left-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-6xl font-black text-slate-900 leading-none mb-1">#{t.ticket_number}</h3>
                        <p className="text-sm font-bold text-slate-500 uppercase">{t.client_name}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => handleAction(t, activeWindow === 3 ? 'done' : 'pass')} className="bg-green-600 text-white py-4 rounded-xl font-black text-xs uppercase hover:bg-green-700 shadow-md">Complete / Pass</button>
                      <button onClick={() => handleAction(t, 'hold')} className="bg-orange-100 text-orange-600 py-4 rounded-xl font-black text-xs uppercase hover:bg-orange-200">Move to Hold Pool</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* COLUMN 2: WAITING LIST (FIFO) */}
          <section className="flex flex-col h-full overflow-hidden bg-white rounded-[3rem] p-8 shadow-sm border border-slate-200">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Waiting List</h2>
            <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {waitingQueue.length === 0 ? (
                <p className="text-center py-10 text-slate-300 font-bold uppercase text-[9px]">No citizens in line</p>
              ) : (
                waitingQueue.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 transition-all">
                    <div>
                      <p className="text-xl font-black text-blue-950 leading-none">#{t.ticket_number}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 truncate w-24">{t.client_name}</p>
                    </div>
                    <button 
                      onClick={() => callTicket(t.id)} 
                      className="bg-white border-2 border-blue-600 text-blue-600 px-4 py-2 rounded-lg font-black text-[9px] uppercase hover:bg-blue-600 hover:text-white transition"
                    >
                      Call Specific
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* COLUMN 3: GLOBAL PENDING POOL */}
          <section className="flex flex-col h-full overflow-hidden bg-slate-900 rounded-[3rem] p-8 shadow-2xl text-white">
            <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6 border-b border-slate-800 pb-4">Global Pending Pool (Hold)</h2>
            <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {pendingPool.length === 0 ? (
                <p className="text-center py-10 text-slate-700 font-bold uppercase text-[9px]">Pool is empty</p>
              ) : (
                pendingPool.map(t => (
                  <div key={t.id} className="p-5 bg-slate-800 rounded-2xl border border-slate-700 hover:border-blue-500 transition-all">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <p className="text-2xl font-black text-white leading-none">#{t.ticket_number}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{t.client_name}</p>
                      </div>
                      <button 
                        onClick={() => callTicket(t.id)} 
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase hover:bg-yellow-400 hover:text-blue-900 transition shadow-lg"
                      >
                        Call Specific
                      </button>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-[9px] font-bold text-slate-500 italic leading-relaxed">
                      "{t.remarks}"
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      </main>

      {/* 3. FOOTER */}
      <footer className="p-4 px-10 border-t border-slate-200 bg-white flex justify-between items-center">
        <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="text-slate-400 font-black hover:text-red-500 transition-colors text-[9px] uppercase tracking-widest">
          ← Logout Session
        </button>
        <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Municipality of Pililla Service Dashboard • 2026</p>
      </footer>
    </div>
  );
}