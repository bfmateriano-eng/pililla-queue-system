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
  status: 'waiting' | 'serving' | 'done';
  current_window: number;
  is_priority: boolean;
  remarks?: string;
  created_at: string;
}

export default function MasterStaffPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeWindow, setActiveWindow] = useState<number>(1); // Defaults to viewing Window 1
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [waitingQueue, setWaitingQueue] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Fetches data based on the selected Window Tab
   */
  const fetchData = useCallback(async (winNum: number) => {
    // 1. Get tickets currently being served at the active tab's window
    const { data: serving } = await supabase
      .from("tickets")
      .select("*")
      .eq("status", "serving")
      .eq("current_window", winNum);

    // 2. Get the waiting queue for the active tab's window
    const { data: waiting } = await supabase
      .from("tickets")
      .select("*")
      .eq("status", "waiting")
      .eq("current_window", winNum)
      .order("is_priority", { ascending: false })
      .order("created_at", { ascending: true });

    setActiveTickets(serving || []);
    setWaitingQueue(waiting || []);
  }, []);

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // FIXED: Allow access if role is 'master', even if window_number is 0
      if (prof && prof.role === 'master') {
        setProfile(prof as Profile);
        await fetchData(activeWindow);
      } else {
        // Kick non-master users back to standard staff portal
        router.push("/dashboard/staff");
      }
      setLoading(false);
    }
    checkUser();

    // Real-time listener: Syncs whenever ANY ticket change occurs
    const channel = supabase
      .channel("master-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        fetchData(activeWindow);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeWindow, fetchData, router]);

  /**
   * Calls a ticket for the currently selected window tab
   */
  async function callTicket(ticketId?: string) {
    let targetId = ticketId;
    if (!targetId && waitingQueue.length > 0) {
      targetId = waitingQueue[0].id;
    }

    if (targetId) {
      await supabase.from("tickets").update({ 
        status: "serving", 
        called_at: new Date().toISOString() 
      }).eq("id", targetId);
    }
  }

  /**
   * Universal action handler for passing, holding, or completing tickets
   */
  async function handleAction(ticket: Ticket, action: 'pass' | 'hold' | 'done') {
    if (action === 'hold') {
      const note = prompt("Enter Remarks (Missing Documents):", ticket.remarks || "");
      if (note === null) return;
      await supabase.from("tickets").update({ 
        status: "waiting", 
        remarks: note || "Lacking requirements",
        is_priority: true 
      }).eq("id", ticket.id);
    } else {
      const nextWin = activeWindow < 3 ? activeWindow + 1 : null;
      const nextStatus = (action === 'done' || !nextWin) ? "done" : "waiting";
      
      await supabase.from("tickets").update({ 
        status: nextStatus,
        current_window: nextWin || activeWindow,
        completed_at: nextStatus === "done" ? new Date().toISOString() : null,
        remarks: null 
      }).eq("id", ticket.id);
    }
  }

  if (loading) return <div className="p-10 font-black text-blue-900 uppercase">Verifying Master Credentials...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* WINDOW SELECTOR TABS */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-[2rem] shadow-sm border border-slate-200">
          {[1, 2, 3].map((num) => (
            <button
              key={num}
              onClick={() => setActiveWindow(num)}
              className={`flex-1 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                activeWindow === num 
                ? 'bg-blue-600 text-white shadow-xl scale-105' 
                : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              Window {num}: {num === 1 ? "Screening" : num === 2 ? "Payment" : "Releasing"}
            </button>
          ))}
        </div>

        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div className="flex items-center gap-5">
            <img src="/lgu-logo.png" className="w-20 h-20 drop-shadow-md" alt="Pililla Logo" />
            <div>
              <h1 className="text-3xl font-black text-blue-950 uppercase tracking-tighter leading-none">
                Master Control Panel
              </h1>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-2">
                Unified Management Mode
              </p>
            </div>
          </div>

          <button 
            onClick={() => callTicket()} 
            disabled={waitingQueue.length === 0}
            className="w-full md:w-auto bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-blue-700 disabled:bg-slate-300 transition-all active:scale-95"
          >
            CALL NEXT ({waitingQueue.length})
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* SERVING LIST FOR SELECTED WINDOW TAB */}
          <div className="lg:col-span-7 space-y-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Active Serving (Win {activeWindow})</h2>
            
            {activeTickets.length === 0 ? (
              <div className="bg-white border-4 border-dashed border-slate-200 rounded-[3rem] p-20 text-center">
                <p className="text-4xl font-black text-slate-200 uppercase italic">Window Idle</p>
              </div>
            ) : (
              activeTickets.map(ticket => (
                <div key={ticket.id} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-between gap-6 animate-in fade-in">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-7xl font-black text-slate-900 leading-none mb-2">#{ticket.ticket_number}</h3>
                      <p className="text-lg font-bold text-slate-500 uppercase">{ticket.client_name}</p>
                    </div>
                    {ticket.remarks && (
                      <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100">
                        <p className="text-[8px] font-black uppercase tracking-widest mb-1">Issue</p>
                        <p className="text-xs font-bold italic">{ticket.remarks}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAction(ticket, activeWindow === 3 ? 'done' : 'pass')} 
                      className="flex-1 bg-green-600 text-white py-4 rounded-xl font-black text-xs uppercase hover:bg-green-700"
                    >
                      {activeWindow === 3 ? "Complete" : "Pass to Next"}
                    </button>
                    <button 
                      onClick={() => handleAction(ticket, 'hold')} 
                      className="flex-1 bg-orange-100 text-orange-600 py-4 rounded-xl font-black text-xs uppercase hover:bg-orange-200"
                    >
                      Hold / Remarks
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* MANUAL SELECTION SIDEBAR */}
          <div className="lg:col-span-5 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 border-b pb-4">
              Window {activeWindow} Queue
            </h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {waitingQueue.length === 0 ? (
                <p className="text-center py-10 text-slate-300 font-bold uppercase text-xs">No pending clients</p>
              ) : (
                waitingQueue.map(ticket => (
                  <div key={ticket.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-xl font-black text-blue-950">#{ticket.ticket_number}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[120px]">{ticket.client_name}</p>
                      {ticket.remarks && <p className="text-[8px] text-red-500 font-black italic mt-1 uppercase">⚠ {ticket.remarks}</p>}
                    </div>
                    <button 
                      onClick={() => callTicket(ticket.id)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase"
                    >
                      Call Specific
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 flex justify-between items-center border-t border-slate-200 pt-8 opacity-50">
           <button 
            onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
            className="text-slate-400 font-black hover:text-red-600 transition-colors text-[10px] uppercase tracking-widest"
          >
            ← Logout Master Panel
          </button>
          <img src="/better-pililla.png" className="h-6 grayscale" alt="Pililla" />
        </footer>
      </div>
    </div>
  );
}