import Link from "next/link";

export default function LGUHome() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-900 text-white p-6 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">LGU QUEUE MANAGEMENT SYSTEM</h1>
          <Link href="/login" className="text-sm font-medium hover:underline opacity-80">
            Staff Login
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-slate-200 max-w-2xl w-full">
          <div className="bg-blue-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          
          <h2 className="text-4xl font-black text-slate-900 mb-4">Welcome to our LGU</h2>
          <p className="text-lg text-slate-600 mb-10 leading-relaxed">
            Please select an option below to get started. 
            Citizens can get a ticket, and staff can manage the windows.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link 
              href="/register" 
              className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-2xl font-bold text-xl shadow-lg transition transform hover:-translate-y-1"
            >
              Get Queue Ticket
            </Link>
            <Link 
              href="/monitor" 
              className="bg-slate-800 hover:bg-slate-900 text-white p-6 rounded-2xl font-bold text-xl shadow-lg transition transform hover:-translate-y-1"
            >
              View Public Monitor
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-slate-400 text-sm">
        © 2026 Local Government Unit Digital Services. All Rights Reserved.
      </footer>
    </div>
  );
}