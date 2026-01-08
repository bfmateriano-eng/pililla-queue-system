"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase";

export default function PublicMonitor() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [marqueeText, setMarqueeText] = useState("Mabuhay! Welcome to the Municipality of Pililla • Serving with Integrity and Excellence • Please wait for your number •");
  const [sidebarText, setSidebarText] = useState("Please have your ID and requirements ready. Mabuhay, Pililla!");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  const formatDisplayName = (ticket: any) => {
    if (!ticket.client_name || ticket.client_name.toLowerCase() === "anonymous" || ticket.client_name === "PENDING") {
      return `Client No. ${String(ticket.ticket_number).padStart(3, '0')}`;
    }
    return ticket.client_name;
  };

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: true });
    
    setTickets(t || []);

    const { data: s } = await supabase.from("settings").select("*");
    if (s) {
      const m = s.find(item => item.id === 'marquee_text')?.value;
      const b = s.find(item => item.id === 'sidebar_announcement')?.value;
      if (m) setMarqueeText(m);
      if (b) setSidebarText(b);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchData();

    const channel = supabase
      .channel("monitor-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) => {
        fetchData();
        if (payload.eventType === "UPDATE" && payload.new.status === "serving" && audioEnabled) {
          announceTicket(payload.new);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [audioEnabled, fetchData]);

  const announceTicket = (ticket: any) => {
    if ('speechSynthesis' in window) {
      let displayName = formatDisplayName(ticket);
      const speechName = displayName
        .replace(/No\./g, "Number") 
        .replace(/0+/g, (match: string, offset: number, string: string) => {
           return string.substring(0, offset).endsWith("Number ") ? "" : match;
        });

      const message = `Now serving, ${speechName}, at Window ${ticket.current_window}`;
      const speech = new SpeechSynthesisUtterance(message);
      speech.rate = 0.85; 
      speech.pitch = 1;
      window.speechSynthesis.speak(speech);
    }
  };

  const getServing = (win: number) => 
    tickets.find(t => t.status === 'serving' && t.current_window === win);
  
  const getWaiting = (win: number) => 
    tickets.filter(t => t.status === 'waiting' && t.current_window === win).slice(0, 4);

  if (!mounted) return null;

  return (
    // min-h-screen ensures it fills the window even if content is small
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-white overflow-hidden font-sans select-none border-0">
      
      {/* HEADER: Fixed height */}
      <div className="flex-none bg-blue-950 p-4 border-b-4 border-yellow-500 flex justify-between items-center px-10 shadow-2xl z-20">
        <div className="flex items-center gap-4">
          <img src="/lgu-logo.png" alt="Logo" className="h-16 w-16" />
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none text-white">Municipality of Pililla</h1>
            <p className="text-[10px] font-bold text-blue-400 tracking-widest uppercase mt-1">Province of Rizal • Queue Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <img src="/better-pililla.png" alt="Better Pililla" className="h-12 object-contain opacity-80" />
          {!audioEnabled && (
            <button onClick={() => setAudioEnabled(true)} className="bg-yellow-500 text-blue-950 px-4 py-2 rounded-full font-black text-[10px] animate-pulse">
              🔊 ENABLE AUDIO
            </button>
          )}
        </div>
      </div>

      {/* MAIN: Grows to fill space between header and footer */}
      <div className="flex-grow grid grid-cols-12 overflow-hidden relative">
        {[1, 2, 3].map((win) => (
          <div key={win} className="col-span-3 border-r border-white/5 flex flex-col bg-slate-900/40">
            {/* SERVING */}
            <div className="h-1/2 p-6 flex flex-col justify-center items-center text-center border-b border-white/5 bg-slate-800/10">
              <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase mb-3 text-white ${
                win === 1 ? 'bg-blue-600' : win === 2 ? 'bg-green-600' : 'bg-purple-600'
              }`}>
                Window {win}
              </span>
              <p className="text-lg font-bold text-slate-300 mb-4 h-10 overflow-hidden uppercase">
                {win === 1 ? "Screening" : win === 2 ? "Payment" : "Releasing"}
              </p>
              
              {getServing(win) ? (
                <div className="animate-in fade-in zoom-in duration-500">
                  <p className="text-[9rem] font-black text-yellow-400 leading-none drop-shadow-2xl">
                    #{getServing(win).ticket_number}
                  </p>
                  <p className="text-xl font-black mt-2 uppercase text-white tracking-tight truncate w-full px-2">
                    {formatDisplayName(getServing(win))}
                  </p>
                </div>
              ) : (
                <p className="text-slate-800 font-black text-5xl italic uppercase opacity-20">Idle</p>
              )}
            </div>

            {/* UPCOMING */}
            <div className="h-1/2 p-6 flex flex-col">
              <h3 className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center">Upcoming List</h3>
              <div className="space-y-2 overflow-hidden">
                {getWaiting(win).map(t => (
                  <div key={t.id} className="bg-white/5 p-4 rounded-xl flex justify-between items-center border-l-4 border-yellow-500 shadow-lg">
                    <span className="text-2xl font-black text-white">#{t.ticket_number}</span>
                    <span className="text-[10px] font-bold opacity-40 uppercase truncate ml-4 tracking-widest">
                      {formatDisplayName(t)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* SIDEBAR */}
        <div className="col-span-3 bg-blue-950/40 p-8 flex flex-col justify-between h-full border-l border-white/5">
            <div>
              <h2 className="text-yellow-500 font-black text-xs uppercase mb-6 tracking-widest border-b-2 border-yellow-500/20 pb-2">Service Steps</h2>
              <div className="space-y-6">
                {[1, 2, 3].map((num) => (
                  <div key={num} className="flex gap-4 items-center">
                    <span className="bg-yellow-500 text-blue-950 w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs">
                      {num}
                    </span>
                    <p className="text-xs font-bold opacity-90 uppercase text-white tracking-tight">
                      {num === 1 && "Verification"}
                      {num === 2 && "Payment"}
                      {num === 3 && "Releasing"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ADVISORY: Added bottom padding to ensure it doesn't touch the marquee */}
            <div className="bg-blue-600/20 p-5 rounded-3xl border border-blue-400/20 shadow-2xl mb-4">
                <p className="text-[9px] font-black text-blue-400 uppercase mb-2 tracking-widest leading-none">Public Advisory</p>
                <p className="text-xs italic font-bold text-blue-100 leading-relaxed">
                  "{sidebarText}"
                </p>
            </div>
        </div>
      </div>

      {/* FOOTER: Fixed height to prevent squishing */}
      <div className="flex-none h-16 bg-yellow-500 flex items-center overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-30">
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="text-blue-950 font-black text-2xl uppercase mx-10">{marqueeText} • {marqueeText}</span>
          <span className="text-blue-950 font-black text-2xl uppercase mx-10">{marqueeText} • {marqueeText}</span>
        </div>
      </div>
    </div>
  );
}