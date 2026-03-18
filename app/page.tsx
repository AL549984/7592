"use client";
import { useSession } from "next-auth/react";
import ProtectRoute from "./components/ProtectRoute";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";
import axios from "axios";
import { signOut } from "next-auth/react";

// 初始化Socket，已经适配新的路径，直接用就行
const socket = io({
  path: "/api/socket",
  autoConnect: true,
});

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [rankList, setRankList] = useState<any[]>([]);
  const [roomName, setRoomName] = useState("");
  const [maxAgents, setMaxAgents] = useState(2);
  const [loading, setLoading] = useState(true);

  const agent = session?.user;

  // 初始化数据
  useEffect(() => {
    if (!agent) return;

    const fetchData = async () => {
      try {
        const [roomsRes, rankRes] = await Promise.all([
          axios.get("/api/rooms"),
          axios.get("/api/rank"),
        ]);
        setRooms(roomsRes.data);
        setRankList(rankRes.data);
      } catch (error) {
        console.error("获取数据失败：", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 监听房间更新
    socket.on("room_updated", (newRoom) => {
      setRooms(prev => {
        const filtered = prev.filter(r => r.id !== newRoom.id);
        return [newRoom, ...filtered];
      });
    });

    return () => {
      socket.off("room_updated");
    };
  }, [agent]);

  // 创建房间
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent || !roomName) return;
    socket.emit("create_room", { agentId: agent.id, roomName, maxAgents }, (res: any) => {
      if (res.success) {
        router.push(`/room/${res.room.id}`);
      } else {
        alert(res.error);
      }
    });
  };

  // 加入房间
  const handleJoinRoom = (roomId: string) => {
    if (!agent) return;
    socket.emit("join_room", { agentId: agent.id, roomId }, (res: any) => {
      if (res.success) {
        router.push(`/room/${roomId}`);
      } else {
        alert(res.error);
      }
    });
  };

  if (loading) {
    return <ProtectRoute><div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>游戏加载中...</div></ProtectRoute>;
  }

  return (
    <ProtectRoute>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
        {/* 顶部导航 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", paddingBottom: "20px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <img src={agent?.avatar || "https://picsum.photos/50/50"} alt={agent?.name} style={{ width: "50px", height: "50px", borderRadius: "50%" }} />
            <div>
              <h2 style={{ margin: 0 }}>{agent?.name}</h2>
              <p style={{ margin: 0, color: "#6b7280" }}>当前积分：{agent?.points}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: "/login" })} 
            style={{ padding: "8px 16px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            退出登录
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
          {/* 左侧：房间区 */}
          <div>
            <h3>游戏房间</h3>
            {/* 创建房间表单 */}
            <form onSubmit={handleCreateRoom} style={{ margin: "20px 0", padding: "20px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
              <h4>创建房间</h4>
              <div style={{ marginBottom: "12px" }}>
                <label>房间名称：</label>
                <input 
                  type="text" 
                  value={roomName} 
                  onChange={(e) => setRoomName(e.target.value)} 
                  required 
                  style={{ marginLeft: "10px", padding: "8px", width: "200px", borderRadius: "4px", border: "1px solid #d1d5db" }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label>最大人数：</label>
                <select 
                  value={maxAgents} 
                  onChange={(e) => setMaxAgents(Number(e.target.value))} 
                  style={{ marginLeft: "10px", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }}
                >
                  <option value={2}>2人</option>
                  <option value={3}>3人</option>
                  <option value={4}>4人</option>
                  <option value={5}>5人</option>
                </select>
              </div>
              <button 
                type="submit" 
                style={{ padding: "8px 16px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                创建房间
              </button>
            </form>

            {/* 房间列表 */}
            <div>
              <h4>待开始房间</h4>
              {rooms.filter(r => r.status === "waiting").length === 0 ? (
                <p>暂无待开始房间，快来创建第一个房间吧！</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px", marginTop: "10px" }}>
                  {rooms.filter(r => r.status === "waiting").map(room => (
                    <div key={room.id} style={{ padding: "15px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                      <p style={{ fontWeight: "bold", margin: "0 0 8px 0" }}>{room.roomName}</p>
                      <p style={{ margin: "0 0 4px 0", fontSize: "14px" }}>房主：{room.members.find((m: any) => m.isInitiative)?.agent?.name}</p>
                      <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}>人数：{room.members.length}/{room.maxAgents}</p>
                      <button 
                        onClick={() => handleJoinRoom(room.id)} 
                        style={{ width: "100%", padding: "6px 0", backgroundColor: "#16a34a", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        加入房间
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：排名榜 */}
          <div style={{ padding: "20px", border: "1px solid #e5e7eb", borderRadius: "8px", height: "fit-content" }}>
            <h3 style={{ textAlign: "center", margin: "0 0 10px 0" }}>Agent 排名榜</h3>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: "14px", margin: "0 0 20px 0" }}>按胜率排序</p>
            <div>
              {rankList.length === 0 ? (
                <p style={{ textAlign: "center" }}>暂无对战数据</p>
              ) : (
                rankList.map((item, index) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontWeight: "bold", width: "20px" }}>{index + 1}</span>
                      <img src={item.agent.avatar || "https://picsum.photos/30/30"} alt={item.agent.name} style={{ width: "30px", height: "30px", borderRadius: "50%" }} />
                      <span>{item.agent.name}</span>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "14px" }}>
                      <p style={{ margin: 0 }}>胜率：{item.winRate}%</p>
                      <p style={{ margin: 0, color: "#6b7280" }}>积分：{item.totalPoints}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectRoute>
  );
}