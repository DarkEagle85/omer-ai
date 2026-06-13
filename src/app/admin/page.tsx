"use client";

import { useEffect, useMemo, useState } from "react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  isActive: boolean;
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
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const filteredUsers = useMemo(() => {
    if (!stats?.users) return [];

    const q = searchText.toLowerCase().trim();

    return stats.users.filter((user) => {
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q) ||
        user.plan.toLowerCase().includes(q) ||
        (user.isActive ? "aktif" : "pasif").includes(q)
      );
    });
  }, [stats, searchText]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const response = await fetch("/api/admin/stats", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
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
    } catch (error) {
      console.error(error);
      setError("Bağlantı hatası");
      setLoading(false);
    }
  }

  async function updateUser(
    userId: string,
    data: {
      dailyMessageLimit?: number;
      role?: string;
      plan?: string;
      resetUsage?: boolean;
      isActive?: boolean;
    }
  ) {
    try {
      setSavingUserId(userId);

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Kullanıcı güncellenemedi");
        setSavingUserId(null);
        return;
      }

      await loadStats();
      setSavingUserId(null);
    } catch (error) {
      console.error(error);
      alert("Bir hata oluştu");
      setSavingUserId(null);
    }
  }

  function updateUserLimit(userId: string, value: number) {
    if (!value || value < 1) {
      alert("Limit en az 1 olmalı");
      return;
    }

    updateUser(userId, {
      dailyMessageLimit: value,
    });
  }

  function updateUserRole(userId: string, role: string) {
    updateUser(userId, { role });
  }

  function updateUserPlan(userId: string, plan: string) {
    updateUser(userId, { plan });
  }

  function resetUserUsage(userId: string) {
    const ok = confirm(
      "Bu kullanıcının günlük kullanımını sıfırlamak istiyor musun?"
    );

    if (!ok) return;

    updateUser(userId, {
      resetUsage: true,
    });
  }

  function toggleUserActive(user: AdminUser) {
    const nextStatus = !user.isActive;

    const ok = confirm(
      nextStatus
        ? "Bu kullanıcıyı tekrar aktif yapmak istiyor musun?"
        : "Bu kullanıcıyı pasifleştirmek istiyor musun?"
    );

    if (!ok) return;

    updateUser(user.id, {
      isActive: nextStatus,
    });
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

          <a
            href="/"
            className="inline-block mt-5 bg-blue-600 hover:bg-blue-700 rounded-xl px-5 py-3 font-semibold"
          >
            Ana Sayfaya Dön
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Ömer AI Admin Panel</h1>
            <p className="text-zinc-400 mt-2">
              Kullanıcı, plan, rol, limit ve kullanım yönetimi
            </p>
          </div>

          <a
            href="/"
            className="bg-blue-600 hover:bg-blue-700 rounded-xl px-5 py-3 font-semibold whitespace-nowrap"
          >
            Ana Sayfa
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="text-zinc-400 text-sm">Toplam Kullanıcı</div>
            <div className="text-4xl font-bold mt-2">{stats?.totalUsers}</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="text-zinc-400 text-sm">Toplam Sohbet</div>
            <div className="text-4xl font-bold mt-2">
              {stats?.totalConversations}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="text-zinc-400 text-sm">Toplam Mesaj</div>
            <div className="text-4xl font-bold mt-2">{stats?.totalMessages}</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Kullanıcılar</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Plan, aktif/pasif, rol, günlük limit ve kullanım sıfırlama
              </p>
            </div>

            <div className="flex gap-3">
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Kullanıcı ara..."
                className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 outline-none text-sm"
              />

              <button
                onClick={loadStats}
                className="bg-zinc-800 hover:bg-zinc-700 rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Yenile
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="text-left p-4">Durum</th>
                  <th className="text-left p-4">İsim</th>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Plan</th>
                  <th className="text-left p-4">Rol</th>
                  <th className="text-left p-4">Limit</th>
                  <th className="text-left p-4">Kullanım</th>
                  <th className="text-left p-4">İşlem</th>
                  <th className="text-left p-4">Kayıt Tarihi</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-t border-zinc-800 hover:bg-zinc-800/40 ${
                      !user.isActive ? "opacity-60" : ""
                    }`}
                  >
                    <td className="p-4">
                      <button
                        onClick={() => toggleUserActive(user)}
                        disabled={savingUserId === user.id}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                          user.isActive
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                      >
                        {user.isActive ? "Aktif" : "Pasif"}
                      </button>
                    </td>

                    <td className="p-4 font-semibold">{user.name}</td>

                    <td className="p-4 text-zinc-300">{user.email}</td>

                    <td className="p-4">
                      <select
                        defaultValue={user.plan}
                        onChange={(e) => updateUserPlan(user.id, e.target.value)}
                        className={`bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none ${
                          user.plan === "admin"
                            ? "text-blue-400"
                            : user.plan === "pro"
                            ? "text-green-400"
                            : "text-zinc-200"
                        }`}
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>

                    <td className="p-4">
                      <select
                        defaultValue={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        className={`bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none ${
                          user.role === "admin"
                            ? "text-blue-400"
                            : "text-zinc-200"
                        }`}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          defaultValue={user.dailyMessageLimit}
                          min={1}
                          className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none text-white"
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            updateUserLimit(user.id, value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const target = e.target as HTMLInputElement;
                              const value = Number(target.value);
                              updateUserLimit(user.id, value);
                              target.blur();
                            }
                          }}
                        />

                        <span className="text-xs text-zinc-500 whitespace-nowrap">
                          mesaj
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      {user.usedMessagesToday} / {user.dailyMessageLimit}
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => resetUserUsage(user.id)}
                        disabled={savingUserId === user.id}
                        className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        {savingUserId === user.id ? "İşleniyor..." : "Sıfırla"}
                      </button>
                    </td>

                    <td className="p-4 text-zinc-400">
                      {new Date(user.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-zinc-500">
                      Aramaya uygun kullanıcı bulunamadı.
                    </td>
                  </tr>
                )}
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