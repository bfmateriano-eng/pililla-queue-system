"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

// --- Types ---
interface Profile {
  id: string;
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
  // Time Tracking Fields for Reports
  serving_started_at?: string;
  hold_started_at?: string;
  total_hold_seconds?: number;
  w1_wait_start?: string;
  w2_wait_start?: string;
  w3_wait_start?: string;
}

export default function StaffWindow() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]); 
  const [waitingQueue, setWaitingQueue] = useState<Ticket[]>([]);   
  const [pendingPool, setPendingPool] = useState<Ticket[]>([]); 
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(async (winNum: number) => {
    // 1. Get Serving
    const { data: serving } = await supabase.from("tickets")
      .select("*").eq("status", "serving").eq("current_window", winNum);

    // 2. Get Local Waiting Queue (Specific to this window)
    const { data: waiting } = await supabase.from("tickets")
      .select("*").eq("status", "waiting").eq("current_window", winNum)
      .order("is_priority", { ascending: false }).order("created_at", { ascending: true });

    // 3. Get Global Pending Pool (Shared by all windows)
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
      if (prof) {
        setProfile(prof as Profile);
        if (prof.window_number) await fetchData(prof.window_number);
      }
      setLoading(false);
    }
    checkUser();

    const channel = supabase.channel("staff-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        if (profile?.window_number) fetchData(profile.window_number);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.window_number, fetchData, router]);

  /**
   * CALL TICKET LOGIC (Supports Call Specific)
   * Calculates "Time Waiting" for current window and starts "Time Elapsed" clock
   */
  async function callTicket(ticketId?: string) {
    if (!profile?.window_number) return;
    const now = new Date();
    let targetId = ticketId;
    if (!targetId && waitingQueue.length > 0) targetId = waitingQueue[0].id;

    if (targetId) {
      // Find ticket in current state to access its specific wait_start timestamp
      const ticket = [...waitingQueue, ...pendingPool].find(t => t.id === targetId);
      let updateData: any = { 
        status: "serving", 
        current_window: profile.window_number,
        serving_started_at: now.toISOString(),
        called_at: now.toISOString() 
      };

      // 1. Record "Time Waiting" for this specific window
      const waitStartKey = `w${profile.window_number}_wait_start` as keyof Ticket;
      if (ticket && ticket[waitStartKey]) {
        const waitSecs = Math.floor((now.getTime() - new Date(ticket[waitStartKey] as string).getTime()) / 1000);
        updateData[`w${profile.window_number}_waiting_seconds`] = waitSecs;
      }

      // 2. If pulled from Pending, calculate "Hold Time" to be excluded from reports
      if (ticket?.status === 'pending' && ticket.hold_started_at) {
        const holdSecs = Math.floor((now.getTime() - new Date(ticket.hold_started_at).getTime()) / 1000);
        updateData.total_hold_seconds = (ticket.total_hold_seconds || 0) + holdSecs;
        updateData.hold_started_at = null; // Reset the hold clock
      }

      await supabase.from("tickets").update(updateData).eq("id", targetId);
    }
  }

  /**
   * HANDLE ACTION LOGIC
   * Calculates "Time Elapsed" for current window and sets wait_start for next window
   */
  async function handleAction(ticket: Ticket, action: 'pass' | 'hold' | 'done') {
    if (!profile) return;
    const now = new Date();

    // 1. Calculate Elapsed Time (Processing Time) at this counter
    let elapsedSecs = 0;
    if (ticket.serving_started_at) {
      elapsedSecs = Math.floor((now.getTime() - new Date(ticket.serving_started_at).getTime()) / 1000);
    }

    let updateData: any = {
      [`w${profile.window_number}_serving_seconds`]: elapsedSecs,
    };

    if (action === 'hold') {
      const note = prompt("Missing Documents/Remarks:", ticket.remarks || "");
      if (note === null) return; 
      updateData.status = "pending";
      updateData.remarks = note || "Lacking Requirements";
      updateData.hold_started_at = now.toISOString(); // Pause the processing clocks
    } else {
      const nextWin = profile.window_number < 3 ? profile.window_number + 1 : null;
      const nextStatus = (action === 'done' || !nextWin) ? "done" : "waiting";
      
      updateData.status = nextStatus;
      updateData.current_window = nextWin || profile.window_number;
      updateData.remarks = null;

      // Start the "Wait Time" clock for the next window stage
      if (nextWin) {
        updateData[`w${nextWin}_wait_start`] = now.toISOString();
      }

      if (nextStatus === "done") {
        updateData.completed_at = now.toISOString();
      }
    }

    await supabase.from("tickets").update(updateData).eq("id", ticket.id);
  }

  if (loading) return <div className="p-10 font-black text-blue-900 uppercase text-center">Initializing Window {profile?.window_number}...</div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      
      {/* HEADER SECTION (FIXED) */}
      <header className="p-6 md:px-10 md:pt-10 bg-slate-50">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-5">
            <img src="/lgu-logo.png" className="w-16 h-16 drop-shadow-md" alt="Pililla Logo" />
            <div>
              <h1 className="text-2xl font-black text-blue-950 uppercase leading-none text-center md:text-left">Window {profile?.window_number}</h1>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mt-2">
                {profile?.window_number === 1 ? "Screening" : profile?.window_number === 2 ? "Payment" : "Releasing"}
              </p>
            </div>
          </div>
          <button 
            onClick={() => callTicket()} 
            disabled={waitingQueue.length === 0} 
            className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 disabled:bg-slate-300 transition-all active:scale-95"
          >
            CALL NEXT ({waitingQueue.length})
          </button>
        </div>
      </header>

      {/* MAIN THREE-COLUMN WORKSPACE (INDEPENDENT SCROLLING) */}
      <main className="flex-grow overflow-hidden p-6 md:px-10">
        <div className="max-w-[1600px] mx-auto h-full grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUMN 1: ACTIVE COUNTER (Independent Scroll) */}
          <section className="lg:col-span-4 h-full flex flex-col overflow-hidden">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 text-center lg:text-left">Live Counter</h2>
            <div className="flex-grow overflow-y-auto space-y-6 pr-2 custom-scrollbar pb-10">
              {activeTickets.length === 0 ? (
                <div className="bg-white border-4 border-dashed border-slate-200 rounded-[3rem] p-12 text-center text-slate-300 font-black italic uppercase">Window Idle</div>
              ) : (
                activeTickets.map(t => (
                  <div key={t.id} className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col gap-6 animate-in fade-in">
                    <div>
                      <span className="bg-blue-50 text-blue-600 font-black text-[8px] px-3 py-1 rounded-full uppercase mb-2 inline-block tracking-widest">Serving Now</span>
                      <h3 className="text-6xl font-black text-slate-900 leading-none mb-1">#{t.ticket_number}</h3>
                      <p className="text-sm font-bold text-slate-500 uppercase">{t.client_name}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => handleAction(t, profile?.window_number === 3 ? 'done' : 'pass')} className="w-full bg-green-600 text-white py-4 rounded-xl font-black text-xs uppercase hover:bg-green-700 transition shadow-sm">Complete / Pass</button>
                      <button onClick={() => handleAction(t, 'hold')} className="w-full bg-orange-100 text-orange-600 py-4 rounded-xl font-black text-xs uppercase hover:bg-orange-200 transition shadow-sm">Hold (Missing Docs)</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* COLUMN 2: LOCAL WAITING QUEUE (Independent Scroll + Call Specific) */}
          <section className="lg:col-span-4 h-full flex flex-col overflow-hidden">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 text-center lg:text-left">Waiting List</h2>
            <div className="flex-grow overflow-y-auto bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 pr-2 custom-scrollbar pb-10">
              <div className="space-y-3">
                {waitingQueue.length === 0 ? (
                  <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">Queue empty</p>
                ) : (
                  waitingQueue.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 transition-all">
                      <div>
                        <p className="text-xl font-black text-blue-950 leading-none">#{t.ticket_number}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 truncate w-24 tracking-tighter">{t.client_name}</p>
                      </div>
                      <button 
                        onClick={() => callTicket(t.id)} 
                        className="bg-white border-2 border-blue-600 text-blue-600 px-4 py-2 rounded-lg font-black text-[10px] uppercase hover:bg-blue-600 hover:text-white transition shadow-sm"
                      >
                        Call
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* COLUMN 3: GLOBAL PENDING POOL (Independent Scroll + Call Specific) */}
          <section className="lg:col-span-4 h-full flex flex-col overflow-hidden">
            <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4 text-center lg:text-left">Global Pending Pool</h2>
            <div className="flex-grow overflow-y-auto bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl text-white pr-2 custom-scrollbar pb-10">
              <div className="space-y-4">
                {pendingPool.length === 0 ? (
                  <p className="text-center py-10 text-slate-600 font-bold uppercase text-[10px]">Pool is empty</p>
                ) : (
                  pendingPool.map(t => (
                    <div key={t.id} className="p-4 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col gap-3 group hover:border-blue-500 transition-all">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">#{t.ticket_number}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{t.client_name}</p>
                        </div>
                        <button 
                          onClick={() => callTicket(t.id)} 
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase hover:bg-yellow-400 hover:text-blue-900 transition-colors shadow-lg"
                        >
                          Re-Activate
                        </button>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-[9px] font-bold text-slate-400 italic">
                        "{t.remarks}"
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* FOOTER SECTION (FIXED) */}
      <footer className="p-4 md:px-10 border-t border-slate-200 flex justify-between items-center bg-white shadow-inner">
        <button 
          onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
          className="text-slate-400 font-black hover:text-red-600 transition-colors text-[9px] uppercase tracking-widest"
        >
          ← Logout Session
        </button>
        <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Municipality of Pililla Service Portal • 2026</p>
      </footer>
    </div>
  );
}