"use client";
import { useSession } from "next-auth/react";
import ProtectRoute from "@/app/components/ProtectRoute";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Link from "next/link";

type Tab = "connect" | "profile" | "plaza" | "discover" | "memory" | "activity";

export default function SecondMePage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("connect");
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    axios.get("/api/secondme/connect").then((res) => {
      setConnected(res.data.connected);
      if (res.data.connected) setActiveTab("profile");
    });
  }, []);

  return (
    <ProtectRoute>
      <div style={styles.page}>
        {/* 顶部导航 */}
        <div style={styles.topBar}>
          <Link href="/" style={styles.backLink}>← 返回大厅</Link>
          <h1 style={styles.title}>SecondMe 功能</h1>
          <span style={{ color: connected ? "#22c55e" : "#f59e0b", fontSize: 13 }}>
            {connected === null ? "检查中..." : connected ? "✓ 已连接" : "未连接"}
          </span>
        </div>

        {/* Tab 切换 */}
        <div style={styles.tabBar}>
          {(["connect", "profile", "plaza", "discover", "memory", "activity"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{ ...styles.tab, ...(activeTab === t ? styles.activeTab : {}) }}
            >
              {{ connect: "连接", profile: "资料", plaza: "Plaza", discover: "发现", memory: "记忆", activity: "动态" }[t]}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div style={styles.content}>
          {activeTab === "connect" && <ConnectTab onConnected={() => { setConnected(true); setActiveTab("profile"); }} connected={connected} />}
          {activeTab === "profile" && <ProfileTab connected={!!connected} />}
          {activeTab === "plaza" && <PlazaTab connected={!!connected} />}
          {activeTab === "discover" && <DiscoverTab connected={!!connected} />}
          {activeTab === "memory" && <MemoryTab connected={!!connected} />}
          {activeTab === "activity" && <ActivityTab connected={!!connected} />}
        </div>
      </div>
    </ProtectRoute>
  );
}

// ────────────────────────── Connect Tab ──────────────────────────

function ConnectTab({ onConnected, connected }: { onConnected: () => void; connected: boolean | null }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    if (!code.startsWith("smc-")) {
      setMsg("授权码格式错误，应以 smc- 开头");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      await axios.post("/api/secondme/connect", { code });
      setMsg("连接成功！");
      onConnected();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "连接失败，请检查授权码");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await axios.delete("/api/secondme/connect").catch(() => null);
    window.location.reload();
  };

  if (connected) {
    return (
      <div style={styles.card}>
        <p style={{ color: "#22c55e", fontWeight: 600 }}>✓ SecondMe API 已连接</p>
        <p style={{ color: "#9ca3af", fontSize: 13, margin: "8px 0 16px" }}>
          你可以通过上方 Tab 使用 Profile、Plaza、Discover、Key Memory、Activity 等功能。
        </p>
        <button onClick={handleDisconnect} disabled={disconnecting} style={styles.dangerBtn}>
          {disconnecting ? "断开中..." : "断开连接"}
        </button>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>连接 SecondMe API</h2>
      <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6 }}>
        在浏览器中打开以下链接完成授权，将页面上的授权码粘贴到下方。
      </p>
      <div style={styles.urlBox}>
        https://second-me.cn/third-party-agent/auth
      </div>
      <p style={{ color: "#9ca3af", fontSize: 13, margin: "8px 0" }}>
        授权码格式：<code style={{ color: "#60a5fa" }}>smc-xxxxxxxxxxxx</code>
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.trim())}
        placeholder="粘贴授权码（smc-...）"
        style={styles.input}
        onKeyDown={(e) => e.key === "Enter" && handleConnect()}
      />
      <button onClick={handleConnect} disabled={loading} style={styles.primaryBtn}>
        {loading ? "连接中..." : "确认连接"}
      </button>
      {msg && <p style={{ color: msg.includes("成功") ? "#22c55e" : "#f87171", marginTop: 8, fontSize: 13 }}>{msg}</p>}
    </div>
  );
}

// ────────────────────────── Profile Tab ──────────────────────────

function ProfileTab({ connected }: { connected: boolean }) {
  const [profile, setProfile] = useState<Record<string, string> | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/secondme/profile");
      setProfile(res.data);
      setForm({ name: res.data.name ?? "", aboutMe: res.data.aboutMe ?? "", originRoute: res.data.originRoute ?? "" });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "加载失败");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (connected) fetchProfile(); }, [connected, fetchProfile]);

  if (!connected) return <NotConnectedHint />;

  const handleSave = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await axios.put("/api/secondme/profile", form);
      setProfile(res.data);
      setEditing(false);
      setMsg("资料已更新");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "保存失败");
    } finally { setLoading(false); }
  };

  if (loading && !profile) return <p style={styles.hint}>加载中...</p>;

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>个人资料</h2>
      {editing ? (
        <>
          {(["name", "aboutMe", "originRoute"] as const).map((field) => (
            <div key={field} style={{ marginBottom: 12 }}>
              <label style={styles.label}>{{ name: "姓名", aboutMe: "自我介绍", originRoute: "主页路由" }[field]}</label>
              <input
                value={form[field] ?? ""}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                style={styles.input}
                placeholder={field === "originRoute" ? "字母+数字，如 alice123" : ""}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={loading} style={styles.primaryBtn}>{loading ? "保存中..." : "保存"}</button>
            <button onClick={() => setEditing(false)} style={styles.secondaryBtn}>取消</button>
          </div>
        </>
      ) : (
        <>
          {profile && (
            <table style={styles.table}>
              <tbody>
                {[["姓名", profile.name], ["自我介绍", profile.aboutMe], ["主页路由", profile.originRoute],
                  ["主页链接", profile.originRoute ? `https://second-me.cn/${profile.originRoute}` : "—"]].map(([k, v]) => (
                  <tr key={k}>
                    <td style={styles.td}>{k}</td>
                    <td style={{ ...styles.td, color: "#e5e7eb" }}>
                      {k === "主页链接" && profile.originRoute
                        ? <a href={v} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>{v}</a>
                        : v || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button onClick={() => setEditing(true)} style={styles.primaryBtn}>编辑资料</button>
        </>
      )}
      {msg && <p style={{ color: msg.includes("更新") ? "#22c55e" : "#f87171", marginTop: 8, fontSize: 13 }}>{msg}</p>}
    </div>
  );
}

// ────────────────────────── Plaza Tab ──────────────────────────

function PlazaTab({ connected }: { connected: boolean }) {
  const [access, setAccess] = useState<{ activated: boolean } | null>(null);
  const [feed, setFeed] = useState<{ items?: unknown[] } | null>(null);
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState("discussion");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchAccess = useCallback(async () => {
    try {
      const res = await axios.get("/api/secondme/plaza?access=1");
      setAccess(res.data);
    } catch { setAccess({ activated: false }); }
  }, []);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/secondme/plaza");
      setFeed(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "加载失败");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (connected) fetchAccess(); }, [connected, fetchAccess]);
  useEffect(() => { if (access?.activated) fetchFeed(); }, [access?.activated, fetchFeed]);

  if (!connected) return <NotConnectedHint />;
  if (!access) return <p style={styles.hint}>检查 Plaza 状态中...</p>;

  const handleRedeem = async () => {
    setLoading(true); setMsg("");
    try {
      await axios.post("/api/secondme/plaza", { action: "redeem", code: inviteCode });
      setMsg("邀请码核销成功！");
      fetchAccess();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "核销失败");
    } finally { setLoading(false); }
  };

  const handlePost = async () => {
    if (!postContent.trim()) { setMsg("内容不能为空"); return; }
    setLoading(true); setMsg("");
    try {
      await axios.post("/api/secondme/plaza", { content: postContent, contentType: postType });
      setMsg("发布成功！");
      setPostContent("");
      fetchFeed();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "发布失败");
    } finally { setLoading(false); }
  };

  if (!access.activated) {
    return (
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Plaza</h2>
        <p style={{ color: "#f59e0b", marginBottom: 12 }}>Plaza 尚未激活，请输入邀请码</p>
        <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.trim())} placeholder="邀请码" style={styles.input} />
        <button onClick={handleRedeem} disabled={loading} style={styles.primaryBtn}>{loading ? "核销中..." : "核销邀请码"}</button>
        {msg && <p style={{ color: "#f87171", marginTop: 8, fontSize: 13 }}>{msg}</p>}
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Plaza 广场</h2>
      {/* 发帖区 */}
      <div style={styles.postBox}>
        <select value={postType} onChange={(e) => setPostType(e.target.value)} style={{ ...styles.input, marginBottom: 8 }}>
          <option value="discussion">讨论</option>
          <option value="ama">AMA</option>
          <option value="info">找信息</option>
        </select>
        <textarea
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
          placeholder="说点什么..."
          style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
        />
        <button onClick={handlePost} disabled={loading || !postContent.trim()} style={styles.primaryBtn}>
          {loading ? "发布中..." : "发布"}
        </button>
      </div>
      {msg && <p style={{ color: msg.includes("成功") ? "#22c55e" : "#f87171", marginTop: 8, fontSize: 13 }}>{msg}</p>}
      {/* 信息流 */}
      <h3 style={{ color: "#9ca3af", fontSize: 14, margin: "16px 0 8px" }}>最新帖子</h3>
      {loading && !feed ? <p style={styles.hint}>加载中...</p> : (
        <div>
          {(feed?.items as Array<{ id?: string; content?: string; contentType?: string }> | undefined)?.length
            ? (feed!.items as Array<{ id?: string; content?: string; contentType?: string }>).map((item, i) => (
              <div key={item.id ?? i} style={styles.feedItem}>
                <span style={styles.feedTag}>{item.contentType ?? "帖子"}</span>
                <p style={{ margin: 0, color: "#e5e7eb", fontSize: 14 }}>{item.content}</p>
              </div>
            ))
            : <p style={styles.hint}>暂无帖子</p>
          }
        </div>
      )}
    </div>
  );
}

// ────────────────────────── Discover Tab ──────────────────────────

function DiscoverTab({ connected }: { connected: boolean }) {
  const [users, setUsers] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchUsers = async () => {
    setLoading(true); setMsg("");
    try {
      const res = await axios.get("/api/secondme/discover");
      const list = (res.data as { list?: unknown[]; items?: unknown[] })?.list
        ?? (res.data as { list?: unknown[]; items?: unknown[] })?.items
        ?? (Array.isArray(res.data) ? res.data : []);
      setUsers(list);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "加载失败");
    } finally { setLoading(false); }
  };

  if (!connected) return <NotConnectedHint />;

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Discover 发现</h2>
      <button onClick={fetchUsers} disabled={loading} style={styles.primaryBtn}>
        {loading ? "搜索中（可能需要 60s）..." : "发现 SecondMe 用户"}
      </button>
      {msg && <p style={{ color: "#f87171", marginTop: 8, fontSize: 13 }}>{msg}</p>}
      <div style={{ marginTop: 12 }}>
        {(users as Array<{ route?: string; username?: string; title?: string; hook?: string; briefIntroduction?: string; matchScore?: number }>).map((u, i) => (
          <div key={u.route ?? i} style={styles.userCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#e5e7eb" }}>{u.username ?? u.route}</strong>
              {u.matchScore !== undefined && (
                <span style={{ fontSize: 12, color: "#60a5fa" }}>匹配度 {u.matchScore}</span>
              )}
            </div>
            {u.title && <p style={{ margin: "4px 0 0", color: "#9ca3af", fontSize: 13 }}>{u.title}</p>}
            {u.hook && <p style={{ margin: "4px 0 0", color: "#d1d5db", fontSize: 13 }}>{u.hook}</p>}
            {u.briefIntroduction && <p style={{ margin: "4px 0 0", color: "#9ca3af", fontSize: 12 }}>{u.briefIntroduction}</p>}
            {u.route && (
              <a
                href={`https://second-me.cn/${u.route}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#60a5fa", fontSize: 12 }}
              >
                https://second-me.cn/{u.route}
              </a>
            )}
          </div>
        ))}
      </div>
      {users.length > 0 && (
        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
          想和感兴趣的人进一步聊天？下载 SecondMe App：<br />
          <a href="https://go.second.me" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>https://go.second.me</a>
        </p>
      )}
    </div>
  );
}

// ────────────────────────── Memory Tab ──────────────────────────

function MemoryTab({ connected }: { connected: boolean }) {
  const [memories, setMemories] = useState<Array<{ id?: number; factContent?: string; content?: string }>>([]);
  const [keyword, setKeyword] = useState("");
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  if (!connected) return <NotConnectedHint />;

  const search = async () => {
    setLoading(true); setMsg("");
    try {
      const res = await axios.get("/api/secondme/memory", { params: keyword ? { keyword } : {} });
      const list = (res.data as { list?: unknown[] })?.list ?? (Array.isArray(res.data) ? res.data : []);
      setMemories(list as Array<{ id?: number; factContent?: string; content?: string }>);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "搜索失败");
    } finally { setLoading(false); }
  };

  const add = async () => {
    if (!newContent.trim()) { setMsg("内容不能为空"); return; }
    setLoading(true); setMsg("");
    try {
      await axios.post("/api/secondme/memory", { content: newContent });
      setMsg("已添加");
      setNewContent("");
      search();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "添加失败");
    } finally { setLoading(false); }
  };

  const remove = async (id: number) => {
    setLoading(true);
    try {
      await axios.delete(`/api/secondme/memory/${id}`);
      setMemories(memories.filter((m) => m.id !== id));
    } catch { setMsg("删除失败"); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Key Memory</h2>
      {/* 搜索 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索关键词（可为空）" style={{ ...styles.input, flex: 1, marginBottom: 0 }} />
        <button onClick={search} disabled={loading} style={styles.primaryBtn}>{loading ? "搜索中..." : "搜索"}</button>
      </div>
      {/* 新增 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="添加新记忆..." style={{ ...styles.input, flex: 1, marginBottom: 0 }} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} disabled={loading || !newContent.trim()} style={styles.primaryBtn}>添加</button>
      </div>
      {msg && <p style={{ color: msg.includes("添加") ? "#22c55e" : "#f87171", marginTop: 0, marginBottom: 8, fontSize: 13 }}>{msg}</p>}
      {/* 列表 */}
      {memories.map((m, i) => (
        <div key={m.id ?? i} style={styles.memoryItem}>
          <p style={{ margin: 0, flex: 1, color: "#e5e7eb", fontSize: 14 }}>{m.factContent ?? m.content}</p>
          {m.id !== undefined && (
            <button onClick={() => remove(m.id!)} style={styles.removeBtn}>删除</button>
          )}
        </div>
      ))}
      {memories.length === 0 && <p style={styles.hint}>暂无记忆，先搜索或添加一条</p>}
    </div>
  );
}

// ────────────────────────── Activity Tab ──────────────────────────

function ActivityTab({ connected }: { connected: boolean }) {
  const [events, setEvents] = useState<unknown[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  if (!connected) return <NotConnectedHint />;

  const fetch = async () => {
    setLoading(true); setMsg("");
    try {
      const params: Record<string, string> = {};
      if (date) params.date = date;
      const res = await axios.get("/api/secondme/activity", { params });
      const list = (res.data as { list?: unknown[]; events?: unknown[]; items?: unknown[] })?.list
        ?? (res.data as { events?: unknown[] })?.events
        ?? (res.data as { items?: unknown[] })?.items
        ?? (Array.isArray(res.data) ? res.data : []);
      setEvents(list);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(err?.response?.data?.error ?? "加载失败");
    } finally { setLoading(false); }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>每日动态</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...styles.input, flex: 1, marginBottom: 0 }} />
        <button onClick={fetch} disabled={loading} style={styles.primaryBtn}>{loading ? "加载中..." : "查询"}</button>
      </div>
      {msg && <p style={{ color: "#f87171", fontSize: 13 }}>{msg}</p>}
      {(events as Array<{ id?: string; type?: string; content?: string; title?: string; createdAt?: string }>).map((e, i) => (
        <div key={(e as { id?: string }).id ?? i} style={styles.eventItem}>
          {e.type && <span style={styles.feedTag}>{e.type}</span>}
          <p style={{ margin: 0, color: "#e5e7eb", fontSize: 14 }}>{e.title ?? e.content}</p>
          {e.createdAt && <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 12 }}>{new Date(e.createdAt).toLocaleString("zh-CN")}</p>}
        </div>
      ))}
      {events.length === 0 && !loading && <p style={styles.hint}>暂无动态，点击查询</p>}
    </div>
  );
}

// ────────────────────────── Shared Components ──────────────────────────

function NotConnectedHint() {
  return (
    <div style={styles.card}>
      <p style={{ color: "#f59e0b" }}>请先到「连接」Tab 完成 SecondMe API 授权</p>
    </div>
  );
}

// ────────────────────────── Styles ──────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", backgroundColor: "#111827", padding: "0 0 40px", fontFamily: "sans-serif" },
  topBar: { display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", borderBottom: "1px solid #1f2937" },
  backLink: { color: "#60a5fa", textDecoration: "none", fontSize: 14 },
  title: { margin: 0, color: "#f9fafb", fontSize: 20, flex: 1 },
  tabBar: { display: "flex", gap: 4, padding: "12px 24px", borderBottom: "1px solid #1f2937" },
  tab: { padding: "6px 16px", borderRadius: 6, border: "none", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 14 },
  activeTab: { background: "#1f2937", color: "#f9fafb" },
  content: { maxWidth: 760, margin: "24px auto", padding: "0 24px" },
  card: { background: "#1f2937", borderRadius: 12, padding: 24 },
  cardTitle: { margin: "0 0 16px", color: "#f9fafb", fontSize: 18 },
  input: { width: "100%", padding: "8px 12px", background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#f9fafb", fontSize: 14, boxSizing: "border-box", marginBottom: 8 },
  label: { display: "block", color: "#9ca3af", fontSize: 12, marginBottom: 4 },
  primaryBtn: { padding: "8px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  secondaryBtn: { padding: "8px 20px", background: "#374151", color: "#f9fafb", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  dangerBtn: { padding: "8px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  urlBox: { background: "#111827", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "#60a5fa", fontSize: 13, fontFamily: "monospace", margin: "8px 0", wordBreak: "break-all" },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: 16 },
  td: { padding: "8px 0", borderBottom: "1px solid #374151", color: "#9ca3af", fontSize: 14, verticalAlign: "top" },
  hint: { color: "#6b7280", textAlign: "center", fontSize: 14 },
  feedItem: { background: "#111827", borderRadius: 8, padding: 12, marginBottom: 8 },
  feedTag: { display: "inline-block", padding: "2px 8px", background: "#1d4ed8", color: "#fff", borderRadius: 4, fontSize: 11, marginBottom: 6 },
  postBox: { background: "#111827", borderRadius: 8, padding: 12, marginBottom: 12 },
  userCard: { background: "#111827", borderRadius: 8, padding: 12, marginBottom: 8 },
  memoryItem: { display: "flex", alignItems: "flex-start", gap: 8, background: "#111827", borderRadius: 8, padding: 12, marginBottom: 8 },
  removeBtn: { padding: "4px 10px", background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, flexShrink: 0 },
  eventItem: { background: "#111827", borderRadius: 8, padding: 12, marginBottom: 8 },
};
