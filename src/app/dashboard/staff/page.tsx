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
  status: 'waiting' | 'serving' | 'done';
  current_window: number;
  is_priority: boolean;
  created_at: string;
}

export default function StaffWindow() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]); // Handles multiple citizens
  const [waitingQueue, setWaitingQueue] = useState<Ticket[]>([]);   // Full list for selection
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Fetches both the currently active tickets and the waiting queue for this window
   */
  const fetchData = useCallback(async (winNum: number) => {
    // 1. Get all tickets currently being served at this specific window
    const { data: serving } = await supabase
      .from("tickets")
      .select("*")
      .eq("status", "serving")
      .eq("current_window", winNum);

    // 2. Get the full list of citizens waiting for this specific window
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

      if (prof) {
        setProfile(prof as Profile);
        if (prof.window_number) await fetchData(prof.window_number);
      }
      setLoading(false);
    }
    checkUser();

    // Real-time listener for updates
    const channel = supabase
      .channel("staff-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        if (profile?.window_number) fetchData(profile.window_number);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.window_number, fetchData, router]);

  /**
   * Function to call a ticket.
   * If an ID is passed (Window 3 selection), it calls that specific ticket.
   * Otherwise (Window 1/2), it calls the first one in the priority queue.
   */
  async function callTicket(ticketId?: string) {
    if (!profile?.window_number) return;

    let targetId = ticketId;
    
    // Auto-select oldest/priority if no specific ID is provided
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
   * Processes the ticket: either passing it to the next window or completing it
   */
  async function handleAction(ticket: Ticket, action: 'pass' | 'requeue') {
    if (!profile) return;

    if (action === 'requeue') {
      await supabase.from("tickets").update({ status: "waiting" }).eq("id", ticket.id);
    } else {
      const nextWin = profile.window_number < 3 ? profile.window_number + 1 : null;
      const nextStatus = nextWin ? "waiting" : "done";
      
      await supabase.from("tickets").update({ 
        status: nextStatus,
        current_window: nextWin || profile.window_number,
        completed_at: nextStatus === "done" ? new Date().toISOString() : null
      }).eq("id", ticket.id);
    }
  }

  if (loading) return <div className="p-10 font-black text-blue-900 uppercase">Verifying Staff Assignment...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div className="flex items-center gap-5">
            <img src="/lgu-logo.png" className="w-20 h-20 drop-shadow-sm" alt="Logo" />
            <div>
              <h1 className="text-3xl font-black text-blue-950 uppercase tracking-tighter leading-none">
                {profile?.window_number ? `Window ${profile.window_number}` : "Access Denied"}
              </h1>
              <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-1">
                {profile?.window_number === 1 && "Verification & Screening"}
                {profile?.window_number === 2 && "Order of Payment"}
                {profile?.window_number === 3 && "Releasing"}
              </p>
            </div>
          </div>

          {/* Persistent "Call Next" Button for Windows 1 and 2 */}
          {profile?.window_number && profile.window_number < 3 && (
            <button 
              onClick={() => callTicket()} 
              disabled={waitingQueue.length === 0}
              className="w-full md:w-auto bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-blue-700 disabled:bg-slate-300 transition-all active:scale-95"
            >
              CALL NEXT CITIZEN ({waitingQueue.length})
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* LEFT SIDE: Currently Serving Citizens (Simultaneous View) */}
          <div className="lg:col-span-7 space-y-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Live Processing</h2>
            
            {activeTickets.length === 0 ? (
              <div className="bg-white border-4 border-dashed border-slate-200 rounded-[3rem] p-20 text-center">
                <p className="text-4xl font-black text-slate-200 uppercase italic">Window Idle</p>
              </div>
            ) : (
              activeTickets.map(ticket => (
                <div key={ticket.id} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 animate-in fade-in slide-in-from-left-5">
                  <div>
                    <span className="bg-blue-50 text-blue-600 font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest">Active Ticket</span>
                    <h3 className="text-7xl font-black text-slate-900 leading-none my-2">#{ticket.ticket_number}</h3>
                    <p className="text-lg font-bold text-slate-500 uppercase">{ticket.client_name}</p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => handleAction(ticket, 'pass')} 
                      className="flex-1 bg-green-600 text-white px-6 py-4 rounded-xl font-black text-xs uppercase hover:bg-green-700 transition shadow-md"
                    >
                      {profile?.window_number === 3 ? "Complete" : "Pass to Next"}
                    </button>
                    <button 
                      onClick={() => handleAction(ticket, 'requeue')} 
                      className="flex-1 bg-slate-100 text-slate-500 px-6 py-4 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition"
                    >
                      Re-queue
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* RIGHT SIDE: Waiting Queue / Selection List */}
          <div className="lg:col-span-5 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 border-b pb-4">
              {profile?.window_number === 3 ? "Manual Selection Queue" : "In Line"}
            </h2>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {waitingQueue.length === 0 ? (
                <p className="text-center py-10 text-slate-300 font-bold uppercase text-xs">Queue is empty</p>
              ) : (
                waitingQueue.map(ticket => (
                  <div key={ticket.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition">
                    <div>
                      <p className="text-xl font-black text-blue-950">#{ticket.ticket_number}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[150px]">{ticket.client_name}</p>
                    </div>
                    {profile?.window_number === 3 ? (
                      <button 
                        onClick={() => callTicket(ticket.id)}
                        className="bg-blue-600 text-white px-5 py-2 rounded-lg font-black text-[10px] uppercase hover:bg-blue-700 transition shadow-sm"
                      >
                        Call Now
                      </button>
                    ) : (
                      ticket.is_priority && <span className="text-orange-500 text-lg">⚠️</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-16 flex justify-between items-center border-t border-slate-200 pt-8">
           <button 
            onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
            className="group flex items-center gap-2 text-slate-400 font-black hover:text-red-600 transition-colors text-[10px] uppercase tracking-widest"
          >
            <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> Logout Staff
          </button>
          <div className="text-right">
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Municipality of Pililla</p>
          </div>
        </footer>
      </div>
    </div>
  );
}