"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";

export default function RegisterKiosk() {
  const [name, setName] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [issuedTicket, setIssuedTicket] = useState<any>(null);
  const [todayTickets, setTodayTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTodayTickets();
    const channel = supabase
      .channel("kiosk-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tickets" }, () => fetchTodayTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchTodayTickets() {
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    setTodayTickets(data || []);
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const now = new Date().toISOString();

    /**
     * SIMPLIFIED LOGIC:
     * We no longer calculate the ticket number or the 'Client No.' string here.
     * The Database Trigger handles the 'JAN13-01' format automatically.
     */
    const { data, error: insertError } = await supabase
      .from("tickets")
      .insert([{ 
        client_name: name.trim() || "Anonymous", 
        is_priority: isPriority,
        status: 'waiting',
        current_window: 1,
        w1_wait_start: now
      }])
      .select()
      .single();

    if (!insertError && data) {
      setIssuedTicket(data);
      setName("");
      setIsPriority(false);
      // Auto-hide the success overlay after 8 seconds
      setTimeout(() => setIssuedTicket(null), 8000);
    } else {
      alert("System Error: " + (insertError?.message || "Unknown error"));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col select-none">
      {/* BRANDING HEADER */}
      <div className="bg-blue-900 p-6 flex justify-between items-center shadow-lg border-b-4 border-yellow-500">
        <div className="flex items-center gap-4">
          <img src="/lgu-logo.png" alt="Logo" className="w-16 h-16 object-contain" />
          <h1 className="text-white text-3xl font-black uppercase tracking-tighter text-center md:text-left">
            Municipality of Pililla
          </h1>
        </div>
        <img src="/better-pililla.png" alt="Brand" className="h-10 opacity-80 hidden md:block" />
      </div>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10 p-10 max-w-7xl mx-auto w-full">
        {/* REGISTRATION FORM */}
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200 flex flex-col justify-center relative overflow-hidden">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-blue-950 uppercase tracking-tight">Kiosk Registration</h2>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">
              Join the queue for Verification (Window 1)
            </p>
          </div>
          
          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Full Name (Optional)</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-bold outline-none focus:border-blue-600 transition"
                placeholder="Enter name or leave blank..."
              />
            </div>

            {/* PRIORITY SELECTION */}
            <div 
              onClick={() => setIsPriority(!isPriority)}
              className={`p-6 rounded-3xl border-4 cursor-pointer transition-all duration-300 flex items-center gap-6 ${
                isPriority ? 'bg-orange-50 border-orange-500 scale-[1.02]' : 'bg-slate-50 border-transparent hover:border-slate-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-full border-4 flex items-center justify-center ${isPriority ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>
                {isPriority && <span className="text-white font-black text-xl">✓</span>}
              </div>
              <div>
                <p className={`font-black uppercase text-lg ${isPriority ? 'text-orange-700' : 'text-slate-400'}`}>Priority Lane</p>
                <p className="text-sm font-bold text-slate-500">Seniors • PWD • Pregnant Women</p>
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white p-8 rounded-[2.5rem] font-black text-3xl shadow-2xl transition active:scale-95 disabled:bg-slate-300"
            >
              {loading ? "PRINTING..." : "GET TICKET"}
            </button>
          </form>

          {/* SUCCESS OVERLAY (Shows JAN13-01 format) */}
          {issuedTicket && (
            <div className="absolute inset-0 bg-green-600 text-white flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-300 z-50">
              <div className="bg-white/20 w-24 h-24 rounded-full flex items-center justify-center mb-6 text-5xl font-black">✓</div>
              <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Ticket Issued Successfully</p>
              <h3 className="text-[7rem] font-black leading-none my-4 tabular-nums">
                {issuedTicket.ticket_number}
              </h3>
              <p className="font-bold text-2xl uppercase tracking-tighter mb-8 italic">
                {issuedTicket.client_name}
              </p>
              <p className="bg-white/10 px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest">
                Please proceed to Window 1
              </p>
            </div>
          )}
        </div>

        {/* RECENT TICKETS LIST */}
        <div className="flex flex-col py-10">
          <h2 className="text-xs font-black text-slate-400 mb-6 uppercase tracking-[0.2em] text-center">Recent Activity</h2>
          <div className="space-y-4">
            {todayTickets.map((t) => (
              <div key={t.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center transition hover:shadow-md">
                <div className="flex items-center gap-6">
                  {/* Now displays the JAN13-01 format here as well */}
                  <span className="text-xl font-black text-blue-600 tabular-nums">
                    {t.ticket_number}
                  </span>
                  <div>
                    <span className="font-black text-slate-800 uppercase text-sm block tracking-tight">
                      {t.client_name}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {t.is_priority && (
                  <span className="bg-orange-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm">Priority</span>
                )}
              </div>
            ))}
            {todayTickets.length === 0 && (
              <p className="text-center text-slate-300 font-bold uppercase py-20 italic">No tickets issued yet today</p>
            )}
          </div>
        </div>
      </main>
      
      <footer className="p-6 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Municipality of Pililla Service Portal • 2026</p>
      </footer>
    </div>
  );
}