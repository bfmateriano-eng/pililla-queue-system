"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [marquee, setMarquee] = useState("");
  const [advisory, setAdvisory] = useState("");
  const [stats, setStats] = useState({ waiting: 0, serving: 0, done: 0 });
  const [windowActivity, setWindowActivity] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState("Analyzing patterns...");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Calculates real-time stats, specifically accounting for simultaneous serving
   */
  const fetchStats = useCallback(async () => {
    const { data: tickets } = await supabase.from("tickets").select("*");
    
    if (tickets) {
      const w = tickets.filter(t => t.status === "waiting").length;
      const s = tickets.filter(t => t.status === "serving").length;
      const d = tickets.filter(t => t.status === "done").length;
      
      setStats({ waiting: w, serving: s, done: d });

      // AI Logic for Pililla LGU
      if (w > 10) setAiInsight("⚠️ HIGH TRAFFIC: Queue is building up. Consider opening an express window.");
      else if (s < 2 && w > 0) setAiInsight("ℹ️ EFFICIENCY: Staff windows are idle while citizens wait.");
      else setAiInsight("✅ STABLE: Current flow is optimal for Pililla.");

      // Calculate simultaneous throughput per window
      const activity = [1, 2, 3].map(winNum => ({
        window: `Win ${winNum}`,
        active: tickets.filter(t => t.status === "serving" && t.current_window === winNum).length,
        waiting: tickets.filter(t => t.status === "waiting" && t.current_window === winNum).length
      }));
      setWindowActivity(activity);
    }
  }, []);

  useEffect(() => {
    async function verifyAdminAndFetch() {
      // 1. Authenticate Session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      // 2. Role-Based Route Guard
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        router.push("/dashboard/staff"); 
        return;
      }

      // 3. Initial Data Fetch
      const { data: settings } = await supabase.from("settings").select("*");
      if (settings) {
        setMarquee(settings.find(s => s.id === "marquee_text")?.value || "");
        setAdvisory(settings.find(s => s.id === "sidebar_announcement")?.value || "");
      }
      
      await fetchStats();
      setLoading(false);
    }

    verifyAdminAndFetch();

    // Real-time listener for live analytics
    const channel = supabase.channel("admin-live").on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => fetchStats()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router, fetchStats]);

  const updateMonitors = async () => {
    await supabase.from("settings").upsert([
      { id: "marquee_text", value: marquee },
      { id: "sidebar_announcement", value: advisory }
    ]);
    alert("Monitors Updated!");
  };

  const resetQueue = async () => {
    if (confirm("Reset everything for tomorrow? (Numbering starts at #1)")) {
      await supabase.from("tickets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.rpc('reset_ticket_sequence'); 
      fetchStats();
    }
  };

  if (loading) return <div className="p-10 font-black uppercase tracking-widest text-blue-900">Accessing Command Center...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-4xl font-black text-[#1e293b] uppercase tracking-tighter">Command Center</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Municipality of Pililla Dashboard</p>
          </div>
          <button 
            onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
            className="text-red-500 font-black text-xs uppercase tracking-widest hover:underline"
          >
            Logout Securely
          </button>
        </div>

        {/* TOP CARDS: Global Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#2563eb] p-8 rounded-[2rem] text-white shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Total Waiting</p>
            <p className="text-7xl font-black leading-none">{stats.waiting}</p>
          </div>
          <div className="bg-[#1e293b] p-8 rounded-[2rem] text-white shadow-xl border-t-4 border-yellow-400">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Active Serving (Global)</p>
            <p className="text-7xl font-black leading-none">{stats.serving}</p>
          </div>
          <div className="bg-[#22c55e] p-8 rounded-[2rem] text-white shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Completed Today</p>
            <p className="text-7xl font-black leading-none">{stats.done}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* LEFT: MONITOR CONTROL */}
          <div className="lg:col-span-4 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
            <h2 className="text-xl font-black text-[#1e293b] uppercase mb-8 border-b pb-4">Display Control</h2>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Footer Marquee</label>
                <textarea value={marquee} onChange={(e) => setMarquee(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" rows={3} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Sidebar Advisory</label>
                <textarea value={advisory} onChange={(e) => setAdvisory(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" rows={3} />
              </div>
              <button onClick={updateMonitors} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg">Update Public Monitors</button>
            </div>
          </div>

          {/* RIGHT: ANALYTICS & MAINTENANCE */}
          <div className="lg:col-span-8 space-y-10">
            
            {/* WINDOW THROUGHPUT CHART: Visualizes Simultaneous Serving */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
              <h2 className="text-xl font-black text-[#1e293b] uppercase mb-8">Window Throughput Analytics</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={windowActivity}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="window" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="active" name="Serving Simultaneously" fill="#2563eb" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="waiting" name="Pending in Queue" fill="#cbd5e1" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase text-center tracking-widest">
                Blue bars indicate how many citizens are currently being processed at each window
              </p>
            </div>

            {/* AI INSIGHTS BOX */}
            <div className="bg-gradient-to-br from-indigo-900 to-blue-900 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">🤖</div>
              <h2 className="text-xl font-black uppercase mb-4 text-indigo-300 tracking-widest leading-none">AI Performance Insight</h2>
              <p className="text-2xl font-bold leading-relaxed relative z-10">{aiInsight}</p>
            </div>

            {/* MAINTENANCE */}
            <div className="bg-[#0f172a] p-10 rounded-[3rem] text-white shadow-xl">
              <h3 className="text-yellow-500 font-black uppercase tracking-widest mb-4">Maintenance</h3>
              <p className="text-sm text-slate-400 mb-6 font-bold uppercase tracking-tight">System Reset: Clears logs and restarts ticket count for the next day.</p>
              <button onClick={resetQueue} className="bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg active:scale-95">Confirm Daily Reset</button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}