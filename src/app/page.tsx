"use client";

import Link from "next/link";

export default function LGUHome() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-blue-900 text-white p-6 shadow-md border-b-4 border-yellow-500">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black tracking-tighter uppercase">Municipality of Pililla</h1>
          <Link href="/login" className="text-xs font-black uppercase tracking-widest hover:underline opacity-80">
            Staff Login
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 max-w-2xl w-full animate-in fade-in zoom-in duration-700">
          
          {/* LGU LOGO INTEGRATION */}
          <div className="mb-8">
            <img 
              src="/lgu-logo.png" 
              className="w-32 h-32 mx-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300" 
              alt="Pililla LGU Logo" 
            />
          </div>
          
          <h2 className="text-4xl font-black text-blue-950 uppercase tracking-tighter mb-4">
            Welcome to Pililla
          </h2>
          <p className="text-lg text-slate-500 mb-10 leading-relaxed font-medium">
            Electronic Queue Management System. <br/>
            Please select an option below to begin your transaction.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link 
              href="/kiosk" 
              className="group bg-blue-600 hover:bg-blue-700 text-white p-8 rounded-3xl font-black text-xl shadow-xl transition-all transform hover:-translate-y-1 flex flex-col items-center gap-2"
            >
              <span className="text-3xl">🎫</span>
              <span>GET TICKET</span>
            </Link>
            <Link 
              href="/monitor" 
              className="group bg-slate-900 hover:bg-slate-800 text-white p-8 rounded-3xl font-black text-xl shadow-xl transition-all transform hover:-translate-y-1 flex flex-col items-center gap-2"
            >
              <span className="text-3xl">📺</span>
              <span>VIEW MONITOR</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-10 text-center flex flex-col items-center gap-4">
        <img src="/better-pililla.png" className="h-8 grayscale opacity-50" alt="Better Pililla Logo" />
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.5em]">
          Serving with Integrity & Excellence • 2026
        </p>
      </footer>
    </div>
  );
}