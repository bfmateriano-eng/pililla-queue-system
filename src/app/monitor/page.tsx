"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase";

export default function PublicMonitor() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [marqueeText, setMarqueeText] = useState("Mabuhay! Welcome to the Municipality of Pililla...");
  const [sidebarText, setSidebarText] = useState("Please have your ID ready.");
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
      setMarqueeText(s.find(item => item.id === 'marquee_text')?.value || marqueeText);
      setSidebarText(s.find(item => item.id === 'sidebar_announcement')?.value || sidebarText);
    }
  }, [marqueeText, sidebarText]);

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
      const speech = new SpeechSynthesisUtterance(`Now serving, ticket ${ticket.ticket_number}, at Window ${ticket.current_window}`);
      speech.rate = 0.9; 
      window.speechSynthesis.speak(speech);
    }
  };

  const getAllServing = (win: number) => tickets.filter(t => t.status === 'serving' && t.current_window === win);
  const getWaiting = (win: number) => tickets.filter(t => t.status === 'waiting' && t.current_window === win);

  if (!mounted) return null;

  return (
    <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans select-none">
      
      {/* HEADER - LOCKED AT 12% */}
      <header className="h-[12%] bg-blue-950 border-b-8 border-yellow-500 flex justify-between items-center px-10 shadow-2xl z-20 flex-none">
        <div className="flex items-center gap-6">
          <img src="/lgu-logo.png" alt="Logo" className="h-16 w-16" />
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Municipality of Pililla</h1>
            <p className="text-[10px] font-bold text-blue-400 tracking-[0.2em] uppercase mt-2">Queue Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {!audioEnabled && (
            <button onClick={() => setAudioEnabled(true)} className="bg-yellow-500 text-blue-950 px-4 py-2 rounded-xl font-black text-[10px] animate-bounce">
              🔊 ENABLE AUDIO
            </button>
          )}
        </div>
      </header>

      {/* MAIN DISPLAY - LOCKED AT 78% */}
      <main className="h-[78%] grid grid-cols-12 overflow-hidden flex-none">
        {[1, 2, 3].map((win) => (
          <div key={win} className="col-span-3 border-r border-white/10 flex flex-col h-full overflow-hidden bg-slate-900/20">
            
            <div className={`h-[50px] flex items-center justify-center font-black uppercase text-xs tracking-[0.2em] flex-none ${
              win === 1 ? 'bg-blue-600' : win === 2 ? 'bg-green-700' : 'bg-purple-700'
            }`}>
              Window {win}
            </div>

            {/* NOW SERVING - LOCKED AT 60% HEIGHT */}
            <div className="h-[60%] p-4 flex flex-col overflow-hidden border-b border-white/5">
               <h2 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-3 text-center opacity-70 flex-none">Now Serving</h2>
               
               <div className="flex-grow overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-2">
                  {getAllServing(win).map((ticket, idx) => (
                    <div 
                      key={ticket.id} 
                      className={`flex flex-col items-center justify-center rounded-2xl border border-yellow-500/20 py-3 flex-none ${
                        idx === 0 ? 'bg-yellow-500/20 border-yellow-500/50 ring-2 ring-yellow-500/10 shadow-lg' : 'bg-white/5 opacity-50'
                      }`}
                    >
                      {/* DYNAMIC FONT SCALE FOR DATE PREFIX */}
                      <span className={`${idx === 0 ? 'text-[clamp(1.5rem,5vw,3.2rem)]' : 'text-xl'} font-black text-yellow-400 tabular-nums leading-none tracking-tighter`}>
                        {ticket.ticket_number}
                      </span>
                      {idx === 0 && <span className="text-[8px] font-bold text-white uppercase opacity-60 truncate w-[80%] text-center mt-1">{ticket.client_name}</span>}
                    </div>
                  ))}
                </div>
               </div>
            </div>

            {/* UP NEXT - LOCKED AT 40% HEIGHT */}
            <div className="h-[40%] p-4 bg-black/40 overflow-hidden flex flex-col flex-none">
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest text-center flex-none">Up Next</h3>
              <div className="flex-grow overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-2">
                  {getWaiting(win).map(t => (
                    <div key={t.id} className="bg-white/5 border border-white/5 rounded-xl py-2 px-4 flex justify-between items-center flex-none">
                      <span className="text-xl font-black text-white tabular-nums tracking-tighter">{t.ticket_number}</span>
                      <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Wait</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* SIDEBAR - LOCKED AT 25% WIDTH */}
        <aside className="col-span-3 bg-blue-950 p-8 flex flex-col justify-between border-l border-white/10 h-full overflow-hidden">
          <div className="space-y-6">
            <h2 className="text-yellow-500 font-black text-xs uppercase tracking-[0.3em] border-b-2 border-yellow-500/20 pb-4">Guide</h2>
            <div className="space-y-8">
              {[{ n: 1, t: "Screening" }, { n: 2, t: "Cashier" }, { n: 3, t: "Releasing" }].map((step) => (
                <div key={step.n} className="flex gap-5 items-center">
                  <span className="bg-yellow-500 text-blue-950 w-10 h-10 rounded-xl flex-none flex items-center justify-center font-black text-lg shadow-lg">{step.n}</span>
                  <p className="text-base font-black uppercase text-white leading-none">{step.t}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-blue-600/20 p-6 rounded-[2.5rem] border-2 border-blue-400/20 shadow-2xl flex-none">
            <p className="text-[11px] font-black text-blue-400 uppercase mb-2 tracking-widest">Advisory</p>
            <p className="text-xs italic font-bold text-white leading-relaxed">"{sidebarText}"</p>
          </div>
        </aside>
      </main>

      {/* 3. FOOTER MARQUEE - LOCKED AT 10% HEIGHT */}
      <footer className="h-[10%] bg-yellow-500 flex items-center overflow-hidden z-30 flex-none shadow-inner">
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="text-blue-950 font-black text-4xl uppercase mx-16">{marqueeText}</span>
          <span className="text-blue-950 font-black text-4xl uppercase mx-16">{marqueeText}</span>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: inline-block; animation: marquee 40s linear infinite; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        .custom-scrollbar::-webkit-scrollbar { width: 0px; }
      `}</style>
    </div>
  );
}