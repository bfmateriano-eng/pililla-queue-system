"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../utils/supabase";

interface Profile {
  id: string;
  email: string;
  role: string;
  window_number: number | null;
  is_active: boolean;
}

export default function StaffManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setProfiles(data || []);
    }
    setLoading(false);
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !currentStatus })
      .eq("id", id);
    
    if (!error) fetchProfiles();
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-900">LGU Staff & Windows</h1>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded text-sm font-medium border border-blue-100">
          Admin Role: Only Admin can manage these accounts
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Email Address</th>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Assignment</th>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {profiles.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition">
                <td className="p-4 text-sm font-medium text-gray-900">{user.email}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded font-bold ${user.window_number ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {user.window_number ? `WINDOW ${user.window_number}` : 'ADMIN'}
                  </span>
                </td>
                <td className="p-4 text-sm">
                  {user.is_active ? (
                    <span className="text-green-600 flex items-center gap-1">● Active</span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1">● Inactive</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => toggleStatus(user.id, user.is_active)}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="p-10 text-center text-gray-400">Loading LGU Personnel...</p>}
      </div>
    </div>
  );
}