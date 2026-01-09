"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase";

export default function PublicMonitor() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [marqueeText, setMarqueeText] = useState("Mabuhay! Welcome to the Municipality of Pililla • Serving with Integrity and Excellence •");
  const [sidebarText, setSidebarText] = useState("Please have your ID and requirements ready. Mabuhay, Pililla!");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Ref to prevent duplicate voice announcements for the same ticket
  const lastAnnouncedId = useRef<string | null>(null);

  const formatDisplayName = (ticket: any) => {
    if (!ticket.client_name || ticket.client_name.toLowerCase() === "anonymous" || ticket.client_name === "PENDING") {
      return `Client No. ${ticket.ticket_number}`;
    }
    return ticket.client_name;
  };

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase
      .from("tickets")
      .select("*")
      .order("called_at", { ascending: false }); // Show most recently called first
    
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
        
        // Only announce if a ticket is moved to 'serving' and isn't the one we just announced
        if (
          payload.eventType === "UPDATE" && 
          payload.new.status === "serving" && 
          audioEnabled && 
          payload.new.id !== lastAnnouncedId.current
        ) {
          lastAnnouncedId.current = payload.new.id;
          announceTicket(payload.new);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [audioEnabled, fetchData]);

  const announceTicket = (ticket: any) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Clear previous queue to announce the newest immediately
      let displayName = formatDisplayName(ticket);
      const message = `Now serving, ${displayName.replace("No.", "Number")}, at Window ${ticket.current_window}`;
      const speech = new SpeechSynthesisUtterance(message);
      speech.rate = 0.9; 
      speech.pitch = 1;
      window.speechSynthesis.speak(speech);
    }
  };

  // NEW: Filter ALL serving tickets for a specific window
  const getAllServing = (win: number) => 
    tickets.filter(t => t.status === 'serving' && t.current_window === win);
  
  const getWaiting = (win: number) => 
    tickets.filter(t => t.status === 'waiting' && t.current_window === win).slice(0, 3);

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans select-none">
      
      {/* HEADER */}
      <div className="flex-none bg-blue-950 p-5 border-b-8 border-yellow-500 flex justify-between items-center px-12 shadow-2xl z-20">
        <div className="flex items-center gap-6">
          <img src="/lgu-logo.png" alt="Logo" className="h-20 w-20" />
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-none text-white">Municipality of Pililla</h1>
            <p className="text-xs font-bold text-blue-400 tracking-[0.2em] uppercase mt-2">Queue Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <img src="/better-pililla.png" alt="Better Pililla" className="h-14 opacity-90" />
          {!audioEnabled && (
            <button onClick={() => setAudioEnabled(true)} className="bg-yellow-500 text-blue-950 px-6 py-3 rounded-2xl font-black text-xs animate-bounce shadow-xl">
              🔊 ENABLE AUDIO
            </button>
          )}
        </div>
      </div>

      {/* MAIN MONITOR AREA */}
      <div className="flex-grow grid grid-cols-12 overflow-hidden bg-[url('/bg-pattern.png')] bg-repeat">
        {[1, 2, 3].map((win) => (
          <div key={win} className="col-span-3 border-r-2 border-white/10 flex flex-col">
            
            {/* WINDOW HEADER */}
            <div className={`p-4 text-center font-black uppercase text-sm tracking-widest ${
              win === 1 ? 'bg-blue-600' : win === 2 ? 'bg-green-700' : 'bg-purple-700'
            }`}>
              Window {win}: {win === 1 ? "Screening" : win === 2 ? "Payment" : "Releasing"}
            </div>

            {/* SIMULTANEOUS SERVING AREA */}
            <div className="flex-grow p-4 flex flex-col gap-4 overflow-y-auto bg-slate-900/50">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-2">Now Serving</p>
               
               {getAllServing(win).length > 0 ? (
                 getAllServing(win).map((ticket, index) => (
                   <div 
                    key={ticket.id} 
                    className={`p-6 rounded-[2rem] text-center border-2 border-yellow-500/30 animate-in fade-in zoom-in duration-500 ${
                      index === 0 ? 'bg-yellow-500/10 shadow-[0_0_30px_rgba(234,179,8,0.2)]' : 'bg-white/5 opacity-60 scale-90'
                    }`}
                   >
                     <p className={`${index === 0 ? 'text-8xl' : 'text-5xl'} font-black text-yellow-400 leading-none`}>
                       #{ticket.ticket_number}
                     </p>
                     <p className={`${index === 0 ? 'text-lg' : 'text-xs'} font-bold mt-2 uppercase text-white truncate`}>
                       {formatDisplayName(ticket)}
                     </p>
                   </div>
                 ))
               ) : (
                 <div className="h-full flex items-center justify-center">
                    <p className="text-slate-800 font-black text-4xl italic uppercase opacity-20 rotate-12">Waiting</p>
                 </div>
               )}
            </div>

            {/* UPCOMING LIST */}
            <div className="h-1/3 p-6 bg-black/20 border-t-2 border-white/5">
              <h3 className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center">Next in Line</h3>
              <div className="space-y-3">
                {getWaiting(win).map(t => (
                  <div key={t.id} className="bg-white/5 p-3 rounded-xl flex justify-between items-center border-l-4 border-blue-500">
                    <span className="text-xl font-black text-white">#{t.ticket_number}</span>
                    <span className="text-[9px] font-bold opacity-40 uppercase truncate ml-4">
                      {formatDisplayName(t)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* SIDEBAR ADVISORY */}
        <div className="col-span-3 bg-blue-950/60 p-10 flex flex-col justify-between border-l-2 border-white/10">
          <div>
            <h2 className="text-yellow-500 font-black text-sm uppercase mb-8 tracking-widest border-b-4 border-yellow-500/20 pb-3">Department Flow</h2>
            <div className="space-y-8">
              {[
                { n: 1, t: "Verification", d: "Document Screening" },
                { n: 2, t: "Payment", d: "Assessment & Fees" },
                { n: 3, t: "Releasing", d: "Permit Collection" }
              ].map((step) => (
                <div key={step.n} className="flex gap-5 items-start">
                  <span className="bg-yellow-500 text-blue-950 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg">
                    {step.n}
                  </span>
                  <div>
                    <p className="text-sm font-black uppercase text-white leading-none">{step.t}</p>
                    <p className="text-[10px] font-bold text-blue-400 uppercase mt-1 tracking-tight">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-600/30 p-8 rounded-[3rem] border-2 border-blue-400/30 shadow-2xl">
            <p className="text-[10px] font-black text-blue-300 uppercase mb-3 tracking-widest">LGU Advisory</p>
            <p className="text-sm italic font-bold text-white leading-relaxed">
              "{sidebarText}"
            </p>
          </div>
        </div>
      </div>

      {/* FOOTER MARQUEE */}
      <div className="flex-none h-20 bg-yellow-500 flex items-center overflow-hidden z-30 shadow-[0_-15px_40px_rgba(0,0,0,0.4)]">
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="text-blue-950 font-black text-4xl uppercase mx-12">{marqueeText}</span>
          <span className="text-blue-950 font-black text-4xl uppercase mx-12">{marqueeText}</span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}