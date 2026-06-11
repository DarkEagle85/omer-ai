"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type User = {
  id: string;
  name: string;
  email: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
};

const welcomeMessage: ChatMessage = {
  role: "assistant",
  content: "Merhaba 👋 Ben Ömer AI. Sana nasıl yardımcı olabilirim?",
};

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");

  if (typeof node === "object" && node !== null && "props" in node) {
    const reactNode = node as { props?: { children?: unknown } };
    return extractText(reactNode.props?.children);
  }

  return "";
}

function TypingIndicator() {
  return (
    <div className="max-w-5xl rounded-2xl p-5 bg-zinc-800 mr-auto">
      <div className="flex items-center gap-2 text-zinc-300">
        <span>Ömer AI düşünüyor</span>
        <span className="flex gap-1">
          <span className="animate-bounce">.</span>
          <span className="animate-bounce delay-150">.</span>
          <span className="animate-bounce delay-300">.</span>
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchText, setSearchText] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamStarted, setStreamStarted] = useState(false);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dailyLimit, setDailyLimit] = useState(20);
  const [usedLimit, setUsedLimit] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [conversations, searchText]);

  const remainingLimit = Math.max(dailyLimit - usedLimit, 0);
  const progressPercent =
    dailyLimit > 0 ? Math.min((usedLimit / dailyLimit) * 100, 100) : 0;

  function getAuthHeaders() {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, streamStarted]);

  function handleScroll() {
    const area = chatAreaRef.current;
    if (!area) return;

    const distanceFromBottom =
      area.scrollHeight - area.scrollTop - area.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 120;
  }

  async function loadProfile() {
    try {
      const response = await fetch("/api/me", {
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (data.user) {
        const freshUser: User = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
        };

        setUser(freshUser);
        localStorage.setItem("user", JSON.stringify(freshUser));

        setDailyLimit(data.user.dailyMessageLimit || 20);
        setUsedLimit(data.user.usedMessagesToday || 0);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function handleAuth() {
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const body = isLogin ? { email, password } : { name, email, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setEmail("");
      setPassword("");
      setName("");
    } else {
      alert(data.error || "İşlem başarısız");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
    setMessages([welcomeMessage]);
    setConversations([]);
    setConversationId(null);
    setSidebarOpen(false);
    setDailyLimit(20);
    setUsedLimit(0);
  }

  async function loadConversations() {
    const response = await fetch("/api/conversations", {
      headers: getAuthHeaders(),
    });

    const data = await response.json();
    setConversations(data.conversations || []);
  }

  async function openConversation(id: string) {
    const response = await fetch(`/api/conversations/${id}`, {
      headers: getAuthHeaders(),
    });

    const data = await response.json();
    if (!data.conversation) return;

    setConversationId(data.conversation.id);

    const loadedMessages = data.conversation.messages.map(
      (msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content,
      })
    );

    setMessages(loadedMessages);
    shouldAutoScrollRef.current = true;
    setSidebarOpen(false);
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    setConversations((prev) => prev.filter((item) => item.id !== id));

    if (conversationId === id) newChat();
  }

  function stopGeneration() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setStreamStarted(false);
  }

  async function sendMessage() {
    if (!message.trim() || loading) return;

    shouldAutoScrollRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
    };

    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setMessage("");
    setLoading(true);
    setStreamStarted(false);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          messages: updatedMessages,
          conversationId,
        }),
      });

      const limitHeader = response.headers.get("X-Daily-Limit");
      const usedHeader = response.headers.get("X-Daily-Used");

      if (limitHeader) setDailyLimit(Number(limitHeader));
      if (usedHeader) setUsedLimit(Number(usedHeader));

      if (response.status === 429) {
        const errorText = await response.text();

        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: errorText || "Günlük mesaj hakkın doldu.",
          },
        ]);

        setLoading(false);
        setStreamStarted(false);
        return;
      }

      const newConversationId = response.headers.get("X-Conversation-Id");

      if (newConversationId) {
        setConversationId(newConversationId);
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const result = await reader.read();
        if (result.done) break;

        fullText += decoder.decode(result.value);
        setStreamStarted(true);

        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: fullText,
          },
        ]);
      }

      await loadConversations();
      await loadProfile();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: "Cevap durduruldu.",
          },
        ]);
      } else {
        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: "Bir hata oluştu.",
          },
        ]);
      }
    }

    abortControllerRef.current = null;
    setLoading(false);
    setStreamStarted(false);
  }

  function newChat() {
    setMessages([welcomeMessage]);
    setConversationId(null);
    setMessage("");
    shouldAutoScrollRef.current = true;
    setSidebarOpen(false);
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6 text-center">Ömer AI</h1>

          {!isLogin && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="İsim"
              className="w-full mb-4 p-4 rounded-xl bg-zinc-800 outline-none"
            />
          )}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full mb-4 p-4 rounded-xl bg-zinc-800 outline-none"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            className="w-full mb-4 p-4 rounded-xl bg-zinc-800 outline-none"
          />

          <button
            onClick={handleAuth}
            className="w-full bg-blue-600 hover:bg-blue-700 p-4 rounded-xl font-bold"
          >
            {isLogin ? "Giriş Yap" : "Kayıt Ol"}
          </button>

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full mt-4 text-zinc-400"
          >
            {isLogin
              ? "Hesabın yok mu? Kayıt ol"
              : "Zaten hesabın var mı? Giriş yap"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex">
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
        />
      )}

      <aside
        className={`fixed md:static z-40 top-0 left-0 h-screen w-72 bg-zinc-900 border-r border-zinc-800 p-4 flex flex-col transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <h1 className="text-2xl font-bold mb-4">Ömer AI</h1>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xl mb-3">
            {user.name?.charAt(0).toUpperCase() || "U"}
          </div>

          <div className="font-semibold truncate">{user.name}</div>
          <div className="text-xs text-zinc-400 truncate">{user.email}</div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Günlük Limit</span>
              <span>
                {remainingLimit} / {dailyLimit}
              </span>
            </div>

            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{
                  width: `${progressPercent}%`,
                }}
              />
            </div>

            <div className="mt-2 text-xs text-zinc-500">Plan: Ücretsiz</div>
          </div>
        </div>

        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Sohbet ara..."
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none mb-4"
        />

        <button
          onClick={newChat}
          className="bg-blue-600 hover:bg-blue-700 rounded-xl p-3 font-semibold"
        >
          + Yeni Sohbet
        </button>

        <button
          onClick={logout}
          className="bg-red-600 hover:bg-red-700 rounded-xl p-3 font-semibold mt-3"
        >
          Çıkış Yap
        </button>

        <div className="mt-6 text-sm text-zinc-400 mb-3">Geçmiş Sohbetler</div>

        <div className="space-y-2 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={`rounded-xl p-3 text-sm flex items-center gap-2 ${
                conversationId === conv.id ? "bg-zinc-800" : "bg-zinc-950"
              }`}
            >
              <button
                onClick={() => openConversation(conv.id)}
                className="text-left flex-1 hover:text-blue-400 truncate"
              >
                {conv.title}
              </button>

              <button
                onClick={() => deleteConversation(conv.id)}
                className="text-red-500 hover:text-red-400 font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-zinc-800 p-4 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden bg-zinc-800 px-3 py-2 rounded-lg"
          >
            ☰
          </button>

          <div>
            <h2 className="text-xl font-semibold">AI Asistan</h2>
            <p className="text-sm text-zinc-400">
              Limit bilgisi girişte yüklenir
            </p>
          </div>
        </header>

        <div
          ref={chatAreaRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`max-w-5xl rounded-2xl p-5 ${
                msg.role === "user"
                  ? "bg-blue-600 ml-auto"
                  : "bg-zinc-800 mr-auto"
              }`}
            >
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre({ children }) {
                      const text = extractText(children);

                      return (
                        <div className="my-4 rounded-xl overflow-hidden border border-zinc-700 bg-black">
                          <div className="bg-zinc-900 px-4 py-2 flex justify-between text-sm">
                            <span className="text-zinc-400">code</span>

                            <button
                              onClick={() => copyText(text)}
                              className="text-zinc-400 hover:text-white"
                            >
                              Kopyala
                            </button>
                          </div>

                          <pre className="p-4 overflow-x-auto text-sm">
                            {children}
                          </pre>
                        </div>
                      );
                    },
                    code({ children }) {
                      return (
                        <code className="bg-zinc-700 px-1 py-0.5 rounded">
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}

          {loading && !streamStarted && <TypingIndicator />}

          <div ref={bottomRef} />
        </div>

        <footer className="border-t border-zinc-800 p-4">
          <div className="max-w-5xl mx-auto flex gap-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Mesaj yaz... Shift + Enter ile alt satır"
              disabled={loading}
              rows={1}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl p-4 outline-none min-w-0 disabled:opacity-60 resize-none max-h-40"
            />

            {loading ? (
              <button
                onClick={stopGeneration}
                className="bg-red-600 hover:bg-red-700 rounded-xl px-5 md:px-6 font-semibold"
              >
                Durdur
              </button>
            ) : (
              <button
                onClick={sendMessage}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl px-5 md:px-6 font-semibold"
              >
                Gönder
              </button>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}
