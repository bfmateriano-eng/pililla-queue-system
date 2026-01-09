"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AdminDashboard() {
  const [marquee, setMarquee] = useState("");
  const [advisory, setAdvisory] = useState("");
  const [stats, setStats] = useState({ waiting: 0, serving: 0, done: 0, pending: 0 });
  const [windowActivity, setWindowActivity] = useState<any[]>([]);
  const [efficiencyData, setEfficiencyData] = useState<any[]>([]); // New Analytics State
  const [aiInsight, setAiInsight] = useState("Analyzing patterns...");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchStats = useCallback(async () => {
    const { data: tickets } = await supabase.from("tickets").select("*");
    
    if (tickets) {
      const w = tickets.filter(t => t.status === "waiting").length;
      const s = tickets.filter(t => t.status === "serving").length;
      const d = tickets.filter(t => t.status === "done").length;
      const p = tickets.filter(t => t.status === "pending").length; 
      
      setStats({ waiting: w, serving: s, done: d, pending: p });

      // Calculate Efficiency Data (Averages in Minutes)
      const efficiency = [1, 2, 3].map(winNum => {
        const completedInWin = tickets.filter(t => (t[`w${winNum}_serving_seconds`] || 0) > 0);
        const avgWait = completedInWin.reduce((acc, t) => acc + (t[`w${winNum}_waiting_seconds`] || 0), 0) / (completedInWin.length || 1);
        const avgServe = completedInWin.reduce((acc, t) => acc + (t[`w${winNum}_serving_seconds`] || 0), 0) / (completedInWin.length || 1);
        
        return {
          window: `Window ${winNum}`,
          waiting: Number((avgWait / 60).toFixed(1)),
          serving: Number((avgServe / 60).toFixed(1))
        };
      });
      setEfficiencyData(efficiency);

      if (w > 10) setAiInsight("⚠️ HIGH TRAFFIC: Queue is building up. Consider opening an express window.");
      else if (p > 5) setAiInsight("📂 PENDING ALERT: Many citizens are in the hold pool due to missing docs.");
      else setAiInsight("✅ STABLE: Current flow is optimal for Pililla.");

      const activity = [1, 2, 3].map(winNum => ({
        window: `Win ${winNum}`,
        active: tickets.filter(t => t.status === "serving" && t.current_window === winNum).length,
        waiting: tickets.filter(t => t.status === "waiting" && t.current_window === winNum).length,
        pending: tickets.filter(t => t.status === "pending" && t.current_window === winNum).length
      }));
      setWindowActivity(activity);
    }
  }, []);

  const exportDetailedReport = async () => {
    const { data: tickets } = await supabase.from("tickets").select("*").eq("status", "done");
    if (!tickets || tickets.length === 0) return alert("No completed tickets found to report.");

    const headers = ["Ticket", "Client", "W1 Wait", "W1 Serving", "W2 Wait", "W2 Serving", "W3 Wait", "W3 Serving", "Total Service Time"].join(",");
    const rows = tickets.map(t => {
      const w1w = t.w1_waiting_seconds || 0; const w1s = t.w1_serving_seconds || 0;
      const w2w = t.w2_waiting_seconds || 0; const w2s = t.w2_serving_seconds || 0;
      const w3w = t.w3_waiting_seconds || 0; const w3s = t.w3_serving_seconds || 0;
      const total = w1w + w1s + w2w + w2s + w3w + w3s;
      return [`#${t.ticket_number}`, t.client_name, `${Math.floor(w1w/60)}m`, `${Math.floor(w1s/60)}m`, `${Math.floor(w2w/60)}m`, `${Math.floor(w2s/60)}m`, `${Math.floor(w3w/60)}m`, `${Math.floor(w3s/60)}m`, `${Math.floor(total/60)}m`].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pililla_LGU_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  useEffect(() => {
    async function verifyAdminAndFetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== 'admin') { router.push("/dashboard/staff"); return; }

      const { data: settings } = await supabase.from("settings").select("*");
      if (settings) {
        setMarquee(settings.find(s => s.id === "marquee_text")?.value || "");
        setAdvisory(settings.find(s => s.id === "sidebar_announcement")?.value || "");
      }
      await fetchStats();
      setLoading(false);
    }
    verifyAdminAndFetch();
    const channel = supabase.channel("admin-live").on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => fetchStats()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router, fetchStats]);

  const updateMonitors = async () => {
    await supabase.from("settings").upsert([{ id: "marquee_text", value: marquee }, { id: "sidebar_announcement", value: advisory }]);
    alert("Monitors Updated!");
  };

  const resetQueue = async () => {
    if (confirm("Reset everything for tomorrow?")) {
      await supabase.from("tickets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.rpc('reset_ticket_sequence'); 
      fetchStats();
    }
  };

  if (loading) return <div className="p-10 font-black uppercase text-blue-900">Command Center Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 md:p-10 font-sans">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black text-[#1e293b] uppercase tracking-tighter">Admin Command Center</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Municipality of Pililla Service Analytics</p>
          </div>
          <div className="flex gap-4">
            <button onClick={exportDetailedReport} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg hover:bg-blue-700 transition-all">Export Performance Report</button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="bg-white text-red-500 border border-red-100 px-6 py-3 rounded-xl font-black text-xs uppercase shadow-sm hover:bg-red-50 transition-colors">Logout</button>
          </div>
        </div>

        {/* TOP CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-[#2563eb] p-8 rounded-[2rem] text-white shadow-xl">
            <p className="text-[10px] font-black uppercase opacity-80 mb-2">In Waiting Queue</p>
            <p className="text-6xl font-black">{stats.waiting}</p>
          </div>
          <div className="bg-[#1e293b] p-8 rounded-[2rem] text-white shadow-xl border-t-4 border-yellow-400">
            <p className="text-[10px] font-black uppercase opacity-80 mb-2">Active Serving</p>
            <p className="text-6xl font-black">{stats.serving}</p>
          </div>
          <div className="bg-orange-600 p-8 rounded-[2rem] text-white shadow-xl">
            <p className="text-[10px] font-black uppercase opacity-80 mb-2">Pending Pool (Hold)</p>
            <p className="text-6xl font-black">{stats.pending}</p>
          </div>
          <div className="bg-[#22c55e] p-8 rounded-[2rem] text-white shadow-xl">
            <p className="text-[10px] font-black uppercase opacity-80 mb-2">Completed Today</p>
            <p className="text-6xl font-black">{stats.done}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <div className="lg:col-span-8 space-y-10">
            {/* NEW: SERVICE EFFICIENCY CHART */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black uppercase">Service Efficiency (Averages)</h2>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><span className="text-[10px] font-bold uppercase text-slate-400">Wait</span></div>
                   <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div><span className="text-[10px] font-bold uppercase text-slate-400">Serve</span></div>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={efficiencyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="window" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="waiting" name="Avg Wait (Min)" fill="#3b82f6" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="serving" name="Avg Serve (Min)" fill="#22c55e" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] text-center font-bold text-slate-400 uppercase mt-4 tracking-widest italic">Note: These averages strictly exclude all time spent in the Pending Pool.</p>
            </div>

            {/* THROUGHPUT ANALYTICS */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
              <h2 className="text-xl font-black uppercase mb-8">Live Window Volume</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={windowActivity}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="window" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="active" name="Serving" fill="#2563eb" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="waiting" name="Waiting" fill="#cbd5e1" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="pending" name="On Hold" fill="#ea580c" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">📊</div>
              <h2 className="text-xl font-black uppercase mb-4 text-blue-400 tracking-widest">AI Efficiency Insight</h2>
              <p className="text-2xl font-bold leading-relaxed">{aiInsight}</p>
            </div>
          </div>

          {/* SIDEBAR CONTROL */}
          <div className="lg:col-span-4 space-y-10">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
              <h2 className="text-xl font-black uppercase mb-8 border-b pb-4">Display Control</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Footer Marquee</label>
                  <textarea value={marquee} onChange={(e) => setMarquee(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" rows={3} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Sidebar Advisory</label>
                  <textarea value={advisory} onChange={(e) => setAdvisory(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" rows={3} />
                </div>
                <button onClick={updateMonitors} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase shadow-lg hover:bg-blue-700 transition-all">Sync Public Monitors</button>
              </div>
            </div>

            <div className="bg-red-50 p-10 rounded-[3rem] border border-red-100">
              <h3 className="text-red-600 font-black uppercase tracking-widest mb-4 italic">Maintenance</h3>
              <button onClick={resetQueue} className="bg-red-600 text-white px-10 py-4 rounded-xl font-black text-xs uppercase shadow-lg hover:bg-red-700 transition-all">Reset Queue System</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}