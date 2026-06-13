"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  dailyMessageLimit: number;
  usedMessagesToday: number;
  createdAt: string;
};

type AdminStats = {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  users: AdminUser[];
};

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch("/api/admin/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Admin bilgileri alınamadı");
        setLoading(false);
        return;
      }

      setStats(data);
      setLoading(false);
    } catch {
      setError("Bağlantı hatası");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-zinc-400">Admin panel yükleniyor...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="bg-zinc-900 border border-red-600 rounded-2xl p-6 max-w-md">
          <h1 className="text-2xl font-bold mb-3">Erişim Hatası</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Ömer AI Admin Panel</h1>
          <p className="text-zinc-400 mt-2">
            Kullanıcı, sohbet ve mesaj istatistikleri
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="text-zinc-400 text-sm">Toplam Kullanıcı</div>
            <div className="text-4xl font-bold mt-2">
              {stats?.totalUsers}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="text-zinc-400 text-sm">Toplam Sohbet</div>
            <div className="text-4xl font-bold mt-2">
              {stats?.totalConversations}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="text-zinc-400 text-sm">Toplam Mesaj</div>
            <div className="text-4xl font-bold mt-2">
              {stats?.totalMessages}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-xl font-semibold">Kullanıcılar</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="text-left p-4">İsim</th>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Rol</th>
                  <th className="text-left p-4">Limit</th>
                  <th className="text-left p-4">Kullanım</th>
                  <th className="text-left p-4">Kayıt Tarihi</th>
                </tr>
              </thead>

              <tbody>
                {stats?.users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-zinc-800 hover:bg-zinc-800/40"
                  >
                    <td className="p-4 font-semibold">{user.name}</td>
                    <td className="p-4 text-zinc-300">{user.email}</td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs ${
                          user.role === "admin"
                            ? "bg-blue-600"
                            : "bg-zinc-700"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">{user.dailyMessageLimit}</td>
                    <td className="p-4">
                      {user.usedMessagesToday} / {user.dailyMessageLimit}
                    </td>
                    <td className="p-4 text-zinc-400">
                      {new Date(user.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          <a
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 rounded-xl px-5 py-3 font-semibold"
          >
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    </main>
  );
}
