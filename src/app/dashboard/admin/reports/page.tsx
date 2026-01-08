"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";

export default function AdminReports() {
  const [reportData, setReportData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    avgWait: 0,
    priorityCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateReport();
  }, []);

  async function generateReport() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReportData(data);
      calculateStats(data);
    }
    setLoading(false);
  }

  function calculateStats(data: any[]) {
    const served = data.filter((t) => t.status === "done");
    
    // Calculate Average Wait Time (in minutes)
    let totalWait = 0;
    served.forEach((t) => {
      const created = new Date(t.created_at).getTime();
      const called = new Date(t.called_at).getTime();
      if (called > created) {
        totalWait += (called - created) / 60000;
      }
    });

    setStats({
      total: data.length,
      avgWait: served.length > 0 ? Math.round(totalWait / served.length) : 0,
      priorityCount: data.filter((t) => t.is_priority).length,
    });
  }

  const exportCSV = () => {
    const headers = ["Ticket #", "Client Name", "Priority", "Status", "Window", "Created At", "Completed At"];
    const rows = reportData.map(t => [
      t.ticket_number,
      t.client_name,
      t.is_priority ? "YES" : "NO",
      t.status,
      t.current_window || "N/A",
      new Date(t.created_at).toLocaleString(),
      t.completed_at ? new Date(t.completed_at).toLocaleString() : "N/A"
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pililla_Queue_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="p-10 font-sans text-slate-900">
      <header className="flex justify-between items-start mb-10">
        <div>
          <h1 className="text-3xl font-black text-blue-950 uppercase tracking-tight">System Reports</h1>
          <p className="text-slate-500 font-medium">Daily performance metrics for the Municipality of Pililla.</p>
        </div>
        <button 
          onClick={exportCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-2xl font-black text-sm transition shadow-lg flex items-center gap-2"
        >
          📥 EXCEL / CSV EXPORT
        </button>
      </header>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Volume</p>
          <p className="text-4xl font-black text-blue-600">{stats.total} <span className="text-sm font-medium text-slate-400">Citizens</span></p>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Avg. Waiting Time</p>
          <p className="text-4xl font-black text-orange-500">{stats.avgWait} <span className="text-sm font-medium text-slate-400">Minutes</span></p>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Priority Served</p>
          <p className="text-4xl font-black text-purple-600">{stats.priorityCount} <span className="text-sm font-medium text-slate-400">Senior/PWD</span></p>
        </div>
      </div>

      {/* Detailed Log Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Transaction Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Ticket</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Client</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Window</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Time Issued</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-black text-blue-600">#{t.ticket_number}</td>
                  <td className="p-4 text-sm font-bold text-slate-700 uppercase">{t.client_name}</td>
                  <td className="p-4 text-xs font-medium text-slate-500">{t.current_window ? `Window ${t.current_window}` : "—"}</td>
                  <td className="p-4 text-xs text-slate-400">{new Date(t.created_at).toLocaleTimeString()}</td>
                  <td className="p-4">
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${
                      t.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="p-10 text-center font-bold text-slate-400 italic">Compiling Report...</p>}
        </div>
      </div>
    </div>
  );
}