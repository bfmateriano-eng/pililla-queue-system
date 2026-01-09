"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";

export default function AdminReports() {
  const [reportData, setReportData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    avgServiceTime: 0,
    priorityCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateReport();
  }, []);

  async function generateReport() {
    setLoading(true);
    // Fetch completed tickets to calculate performance metrics
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("completed_at", { ascending: false });

    if (!error && data) {
      setReportData(data);
      calculateStats(data);
    }
    setLoading(false);
  }

  function calculateStats(data: any[]) {
    const served = data.filter((t) => t.status === "done");
    
    // Calculate Average Actual Service Time (Excluding Hold Pool)
    let totalServiceSeconds = 0;
    served.forEach((t) => {
      const w1w = t.w1_waiting_seconds || 0;
      const w1s = t.w1_serving_seconds || 0;
      const w2w = t.w2_waiting_seconds || 0;
      const w2s = t.w2_serving_seconds || 0;
      const w3w = t.w3_waiting_seconds || 0;
      const w3s = t.w3_serving_seconds || 0;
      
      // The sum of these columns represents actual LGU work time
      totalServiceSeconds += (w1w + w1s + w2w + w2s + w3w + w3s);
    });

    setStats({
      total: data.length,
      // Convert total seconds to average minutes
      avgServiceTime: served.length > 0 ? Math.round((totalServiceSeconds / served.length) / 60) : 0,
      priorityCount: data.filter((t) => t.is_priority).length,
    });
  }

  const exportCSV = () => {
    // Advanced headers including per-window breakdown
    const headers = [
      "Ticket #", "Client Name", "Priority", 
      "W1 Waiting", "W1 Serving", 
      "W2 Waiting", "W2 Serving", 
      "W3 Waiting", "W3 Serving", 
      "Total Service Time (Min)", "Completed At"
    ];

    const rows = reportData.map(t => {
      const w1w = t.w1_waiting_seconds || 0;
      const w1s = t.w1_serving_seconds || 0;
      const w2w = t.w2_waiting_seconds || 0;
      const w2s = t.w2_serving_seconds || 0;
      const w3w = t.w3_waiting_seconds || 0;
      const w3s = t.w3_serving_seconds || 0;
      const totalSecs = w1w + w1s + w2w + w2s + w3w + w3s;

      return [
        `#${t.ticket_number}`,
        t.client_name,
        t.is_priority ? "YES" : "NO",
        `${Math.floor(w1w / 60)}m ${w1w % 60}s`,
        `${Math.floor(w1s / 60)}m ${w1s % 60}s`,
        `${Math.floor(w2w / 60)}m ${w2w % 60}s`,
        `${Math.floor(w2s / 60)}m ${w2s % 60}s`,
        `${Math.floor(w3w / 60)}m ${w3w % 60}s`,
        `${Math.floor(w3s / 60)}m ${w3s % 60}s`,
        (totalSecs / 60).toFixed(2),
        t.completed_at ? new Date(t.completed_at).toLocaleString() : "N/A"
      ];
    });

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pililla_Service_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-black text-blue-950 uppercase tracking-tighter">Performance Reports</h1>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">Detailed Service Analytics • Pililla LGU</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
             <button 
              onClick={generateReport}
              className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-50 transition shadow-sm"
            >
              🔄 Refresh
            </button>
            <button 
              onClick={exportCSV}
              className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase transition shadow-lg flex items-center justify-center gap-2"
            >
              📥 Export CSV
            </button>
          </div>
        </header>

        {/* Analytics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Volume</p>
            <p className="text-5xl font-black text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 border-t-4 border-t-orange-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Avg. Service Time</p>
            <p className="text-5xl font-black text-orange-500">{stats.avgServiceTime} <span className="text-sm font-bold uppercase text-slate-400">Min</span></p>
            <p className="text-[9px] text-slate-400 mt-2 font-bold italic">Excluding time spent in Hold Pool</p>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Priority Volume</p>
            <p className="text-5xl font-black text-purple-600">{stats.priorityCount}</p>
          </div>
        </div>

        {/* Transaction Log */}
        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Master Transaction Log</h3>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">Live Data</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase">Ticket</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase">Client Name</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase text-center">W1 (Wait/Serve)</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase text-center">W2 (Wait/Serve)</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase text-center">W3 (Wait/Serve)</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reportData.map((t) => (
                  <tr key={t.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-6 font-black text-blue-600 text-lg italic">#{t.ticket_number}</td>
                    <td className="p-6">
                      <p className="text-sm font-black text-slate-700 uppercase leading-none">{t.client_name}</p>
                      {t.is_priority && <span className="text-[8px] font-black text-orange-500 uppercase tracking-tighter">Priority Citizen</span>}
                    </td>
                    <td className="p-6 text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                         {t.w1_waiting_seconds ? `${Math.floor(t.w1_waiting_seconds/60)}m` : '0m'} / {t.w1_serving_seconds ? `${Math.floor(t.w1_serving_seconds/60)}m` : '0m'}
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                         {t.w2_waiting_seconds ? `${Math.floor(t.w2_waiting_seconds/60)}m` : '0m'} / {t.w2_serving_seconds ? `${Math.floor(t.w2_serving_seconds/60)}m` : '0m'}
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                         {t.w3_waiting_seconds ? `${Math.floor(t.w3_waiting_seconds/60)}m` : '0m'} / {t.w3_serving_seconds ? `${Math.floor(t.w3_serving_seconds/60)}m` : '0m'}
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${
                        t.status === 'done' ? 'bg-green-100 text-green-700' : 
                        t.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <div className="p-20 text-center animate-pulse"><p className="font-black text-blue-900 uppercase tracking-widest">Compiling Pililla LGU Metrics...</p></div>}
            {!loading && reportData.length === 0 && <p className="p-20 text-center font-bold text-slate-300 uppercase">No records found for this period</p>}
          </div>
        </div>
        
        <footer className="mt-10 opacity-30 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.5em]">LGU Service Analytics Engine • 2026</p>
        </footer>
      </div>
    </div>
  );
}