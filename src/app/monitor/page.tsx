"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase";

export default function PublicMonitor() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [marqueeText, setMarqueeText] = useState("Mabuhay! Welcome to the Municipality of Pililla • Serving with Integrity and Excellence •");
  const [sidebarText, setSidebarText] = useState("Please have your ID and requirements ready. Mabuhay, Pililla!");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastAnnouncedId = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase
      .from("tickets")
      .select("*")
      .order("called_at", { ascending: false });
    
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

    const channel = supabase.channel("monitor-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) => {
        fetchData();
        if (payload.eventType === "UPDATE" && payload.new.status === "serving" && audioEnabled && payload.new.id !== lastAnnouncedId.current) {
          lastAnnouncedId.current = payload.new.id;
          announceTicket(payload.new);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [audioEnabled, fetchData]);

  const announceTicket = (ticket: any) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(`Now serving, ticket number ${ticket.ticket_number}, at Window ${ticket.current_window}`);
      speech.rate = 0.9; 
      window.speechSynthesis.speak(speech);
    }
  };

  const getAllServing = (win: number) => tickets.filter(t => t.status === 'serving' && t.current_window === win);
  const getWaiting = (win: number) => tickets.filter(t => t.status === 'waiting' && t.current_window === win);

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans select-none">
      
      {/* HEADER */}
      <div className="flex-none bg-blue-950 p-4 border-b-4 border-yellow-500 flex justify-between items-center px-10 shadow-2xl z-20">
        <div className="flex items-center gap-4">
          <img src="/lgu-logo.png" alt="Logo" className="h-14 w-14" />
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Municipality of Pililla</h1>
        </div>
        {!audioEnabled && (
          <button onClick={() => setAudioEnabled(true)} className="bg-yellow-500 text-blue-950 px-4 py-2 rounded-xl font-black text-[10px] animate-pulse">
            🔊 ENABLE AUDIO
          </button>
        )}
      </div>

      {/* MAIN MONITOR GRID */}
      <div className="flex-grow grid grid-cols-12 overflow-hidden">
        {[1, 2, 3].map((win) => (
          <div key={win} className="col-span-3 border-r border-white/10 flex flex-col h-full overflow-hidden bg-slate-900/20">
            
            <div className={`p-3 text-center font-black uppercase text-xs tracking-[0.2em] flex-none ${
              win === 1 ? 'bg-blue-600' : win === 2 ? 'bg-green-700' : 'bg-purple-700'
            }`}>
              Window {win}: {win === 1 ? "Screening" : win === 2 ? "Payment" : "Releasing"}
            </div>

            {/* NOW SERVING SECTION (GRID VIEW) */}
            <div className="flex-grow p-4 flex flex-col overflow-hidden">
               <h2 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-3 text-center opacity-70">Now Serving</h2>
               
               <div className="flex-grow overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-2">
                  {getAllServing(win).map((ticket, idx) => (
                    <div 
                      key={ticket.id} 
                      className={`flex flex-col items-center justify-center rounded-2xl border border-yellow-500/20 p-3 animate-in zoom-in duration-300 ${
                        idx === 0 ? 'bg-yellow-500/20 border-yellow-500/50 ring-2 ring-yellow-500/20' : 'bg-white/5'
                      }`}
                    >
                      <span className={`${idx === 0 ? 'text-5xl' : 'text-3xl'} font-black text-yellow-400 tabular-nums`}>
                        #{ticket.ticket_number}
                      </span>
                      {idx === 0 && <span className="text-[8px] font-bold text-white uppercase opacity-60 truncate w-full text-center">{ticket.client_name}</span>}
                    </div>
                  ))}
                </div>
                {getAllServing(win).length === 0 && (
                  <div className="h-full flex items-center justify-center opacity-10">
                    <p className="text-4xl font-black italic uppercase rotate-12">Standby</p>
                  </div>
                )}
               </div>
            </div>

            {/* NEXT IN LINE SECTION (COMPACT GRID) */}
            <div className="h-[40%] p-4 bg-black/40 border-t border-white/10 overflow-hidden flex flex-col">
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest text-center">Next in Line</h3>
              <div className="flex-grow overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-3 gap-2">
                  {getWaiting(win).map(t => (
                    <div key={t.id} className="bg-white/5 border border-white/5 rounded-lg py-2 flex flex-col items-center justify-center">
                      <span className="text-xl font-black text-white tabular-nums">#{t.ticket_number}</span>
                      <span className="text-[7px] font-bold text-blue-400 uppercase tracking-tighter">Wait</span>
                    </div>
                  ))}
                </div>
                {getWaiting(win).length === 0 && <p className="text-center text-[9px] font-bold text-slate-700 uppercase py-10 italic">Lobby Empty</p>}
              </div>
            </div>
          </div>
        ))}

        {/* SIDEBAR DEPARTMENT GUIDE */}
        <div className="col-span-3 bg-blue-950/80 p-8 flex flex-col justify-between border-l border-white/10">
          <div className="space-y-10">
            <h2 className="text-yellow-500 font-black text-xs uppercase tracking-[0.3em] border-b border-yellow-500/20 pb-4">Department Guide</h2>
            <div className="space-y-8">
              {[
                { n: 1, t: "Screening", d: "Requirements Check" },
                { n: 2, t: "Cashier", d: "Assessment & Pay" },
                { n: 3, t: "Releasing", d: "Claim Documents" }
              ].map((step) => (
                <div key={step.n} className="flex gap-4 items-center">
                  <span className="bg-yellow-500 text-blue-950 w-10 h-10 rounded-xl flex-none flex items-center justify-center font-black text-lg shadow-lg">
                    {step.n}
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase text-white leading-none">{step.t}</p>
                    <p className="text-[9px] font-bold text-blue-400 uppercase mt-1 tracking-widest">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-600/10 p-6 rounded-[2rem] border border-blue-400/20">
            <p className="text-[9px] font-black text-blue-400 uppercase mb-2 tracking-widest">Notice</p>
            <p className="text-xs italic font-medium text-white/80 leading-relaxed italic line-clamp-4">
              "{sidebarText}"
            </p>
          </div>
        </div>
      </div>

      {/* FOOTER MARQUEE */}
      <div className="flex-none h-16 bg-yellow-500 flex items-center overflow-hidden z-30">
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="text-blue-950 font-black text-3xl uppercase mx-12">{marqueeText}</span>
          <span className="text-blue-950 font-black text-3xl uppercase mx-12">{marqueeText}</span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { display: inline-block; animation: marquee 30s linear infinite; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        .custom-scrollbar::-webkit-scrollbar { width: 0px; }
      `}</style>
    </div>
  );
}