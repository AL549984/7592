"use client";
import { useSession } from "next-auth/react";
import ProtectRoute from "@/app/components/ProtectRoute";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";

// 初始化Socket，适配新的路径
const socket = io({
  path: "/api/socket",
  autoConnect: true,
});

export default function RoomPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();

  // 修复：空值处理+类型保护，避免params为null报错
  const roomId = params?.id as string | undefined;

  const [room, setRoom] = useState<any>(null);
  const [myDice, setMyDice] = useState<number[]>([]);
  const [callNumber, setCallNumber] = useState(1);
  const [callPoint, setCallPoint] = useState(1);
  const [isZhai, setIsZhai] = useState(false);
  const [currentRound, setCurrentRound] = useState<any>(null);
  const [gameResult, setGameResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const agent = session?.user;
  const isCreator = room?.creatorId === agent?.id;

  // 修复：兜底处理，roomId不存在时自动跳回首页
  useEffect(() => {
    if (!roomId) {
      router.push("/");
      return;
    }
    if (!agent) return;

    const fetchRoom = async () => {
      try {
        const res = await axios.get(`/api/room/${roomId}`);
        setRoom(res.data);
        // 未加入房间则返回首页
        if (!res.data.members.some((m: any) => m.agentId === agent.id)) {
          router.push("/");
          alert("你未加入该房间");
        }
      } catch (error) {
        router.push("/");
        alert("房间不存在");
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
    socket.emit("join_room", { agentId: agent.id, roomId });

    // 监听事件
    socket.on("room_updated", (newRoom) => {
      if (newRoom.id === roomId) setRoom(newRoom);
    });
    // dice_rolled 仅用于通知其他玩家有人已摇骰，骰子值通过 roll_dice 回调获取
    socket.on("dice_rolled", (_data) => {
      // 不在此处更新骰子，避免用 undefined 覆盖已通过回调正确设置的 myDice
    });
    socket.on("dice_called", (data) => {
      if (data.roomId === roomId) setCurrentRound(data.round);
    });
    socket.on("dice_opened", (data) => {
      if (data.roomId === roomId) {
        setGameResult(data.result);
        setCurrentRound(null);
        setRoom(data.updatedRoom);
      }
    });

    return () => {
      socket.off("room_updated");
      socket.off("dice_rolled");
      socket.off("dice_called");
      socket.off("dice_opened");
    };
  }, [agent, roomId, router]);

  // 摇骰
  const handleRollDice = () => {
    if (!agent || !roomId) return;
    socket.emit("roll_dice", { agentId: agent.id, roomId }, (res: any) => {
      if (res.success) {
        setMyDice(res.dicePoints);
      } else {
        alert(res.error);
      }
    });
  };

  // 叫骰
  const handleCallDice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent || !roomId) return;
    socket.emit("call_dice", { agentId: agent.id, roomId, callNumber, callPoint, isZhai }, (res: any) => {
      if (res.success) {
        alert(`叫骰成功！你叫了${callNumber}个${callPoint}${isZhai ? "（斋）" : ""}`);
      } else {
        alert(res.error);
      }
    });
  };

  // 开骰
  const handleOpenDice = (type: "normal" | "pi" | "fanpi" = "normal") => {
    if (!agent || !roomId || !currentRound) return;
    if (window.confirm(`确定要${type === "normal" ? "开骰" : type === "pi" ? "劈" : "反劈"}吗？`)) {
      socket.emit("open_dice", { agentId: agent.id, roomId, isFanFan: type === "pi" ? "pi" : type === "fanpi" ? "fanpi" : "normal" }, (res: any) => {
        if (!res.success) alert(res.error);
      });
    }
  };

  // 退出房间
  const handleLeaveRoom = () => {
    if (!agent || !roomId) return;
    if (window.confirm("确定要退出房间吗？")) {
      socket.emit("leave_room", { agentId: agent.id, roomId }, () => {
        router.push("/");
      });
    }
  };

  // 重新开局
  const handleRestart = async () => {
    if (!isCreator) return alert("只有房主可以重新开局");
    if (!roomId) return;
    try {
      await axios.post(`/api/room/restart/${roomId}`);
      setMyDice([]);
      setGameResult(null);
      setCurrentRound(null);
      alert("重新开局成功！请重新摇骰");
    } catch (error) {
      alert("重新开局失败");
    }
  };

  if (loading || !room) {
    return <ProtectRoute><div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>房间加载中...</div></ProtectRoute>;
  }

  return (
    <ProtectRoute>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
        {/* 顶部导航 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2>房间：{room.roomName}</h2>
          <button onClick={handleLeaveRoom} style={{ padding: "6px 12px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            退出房间
          </button>
        </div>

        {/* 房间成员 */}
        <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
          <h3 style={{ margin: "0 0 10px 0" }}>房间成员</h3>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
            {room.members.map((m: any) => (
              <div key={m.id} style={{ textAlign: "center" }}>
                <img src={m.agent.avatar || "https://picsum.photos/40/40"} alt={m.agent.name} style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
                <p style={{ margin: "5px 0 0 0", fontSize: "14px" }}>{m.agent.name}{m.isInitiative ? "（房主）" : ""}</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>积分：{m.agent.points}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 我的骰子 */}
        <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
          <h3 style={{ margin: "0 0 10px 0" }}>我的骰子</h3>
          {myDice.length === 0 ? (
            <button 
              onClick={handleRollDice} 
              style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "16px" }}
            >
              点击摇骰
            </button>
          ) : (
            <div style={{ display: "flex", gap: "10px" }}>
              {myDice.map((point, index) => (
                <div key={index} style={{ 
                  width: "50px", height: "50px", 
                  border: "2px solid #2563eb", borderRadius: "8px", 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "24px", fontWeight: "bold"
                }}>
                  {point}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 当前叫骰 */}
        {currentRound && (
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#f0f9ff" }}>
            <h3 style={{ margin: "0 0 10px 0" }}>当前叫骰</h3>
            <p style={{ fontSize: "18px", fontWeight: "bold", margin: 0 }}>
              {room.members.find((m: any) => m.agentId === currentRound.callerId)?.agent?.name} 叫了：
              {currentRound.callNumber} 个 {currentRound.callPoint}
              {currentRound.isZhai ? "（斋）" : ""}
            </p>
          </div>
        )}

        {/* 叫骰表单 */}
        {myDice.length > 0 && !gameResult && (
          <form onSubmit={handleCallDice} style={{ marginBottom: "20px", padding: "15px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 10px 0" }}>我要叫骰</h3>
            <div style={{ display: "flex", gap: "15px", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <label>数量：</label>
                <input 
                  type="number" 
                  min="1" 
                  value={callNumber} 
                  onChange={(e) => setCallNumber(Number(e.target.value))} 
                  style={{ width: "60px", padding: "8px", marginLeft: "5px", borderRadius: "4px", border: "1px solid #d1d5db" }}
                />
              </div>
              <div>
                <label>点数：</label>
                <input 
                  type="number" 
                  min="1" 
                  max="6" 
                  value={callPoint} 
                  onChange={(e) => setCallPoint(Number(e.target.value))} 
                  style={{ width: "60px", padding: "8px", marginLeft: "5px", borderRadius: "4px", border: "1px solid #d1d5db" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <input 
                  type="checkbox" 
                  id="zhai" 
                  checked={isZhai} 
                  onChange={(e) => setIsZhai(e.target.checked)} 
                />
                <label htmlFor="zhai">斋（取消1的万能属性）</label>
              </div>
            </div>
            <button 
              type="submit" 
              style={{ padding: "8px 16px", backgroundColor: "#16a34a", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              确认叫骰
            </button>
          </form>
        )}

        {/* 开骰操作 */}
        {currentRound && currentRound.callerId !== agent?.id && !gameResult && (
          <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
            <button 
              onClick={() => handleOpenDice("normal")} 
              style={{ padding: "10px 20px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              开骰（输扣5分）
            </button>
            <button 
              onClick={() => handleOpenDice("pi")} 
              style={{ padding: "10px 20px", backgroundColor: "#ea580c", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              劈（输扣10分）
            </button>
            <button 
              onClick={() => handleOpenDice("fanpi")} 
              style={{ padding: "10px 20px", backgroundColor: "#7c2d12", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              反劈（输扣15分）
            </button>
          </div>
        )}

        {/* 游戏结果 */}
        {gameResult && (
          <div style={{ marginBottom: "20px", padding: "20px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#fef3c7" }}>
            <h3 style={{ margin: "0 0 15px 0", textAlign: "center", fontSize: "20px" }}>游戏结果</h3>
            <p style={{ textAlign: "center", fontSize: "18px", margin: "0 0 10px 0" }}>
              叫骰：{gameResult.callNumber} 个 {gameResult.callPoint}{gameResult.isZhai ? "（斋）" : ""}
            </p>
            <p style={{ textAlign: "center", fontSize: "18px", margin: "0 0 10px 0" }}>
              全场实际总数：<b>{gameResult.totalPoint}</b> 个
            </p>
            <p style={{ textAlign: "center", fontSize: "18px", fontWeight: "bold", margin: "0 0 15px 0" }}>
              {room.members.find((m: any) => m.agentId === gameResult.winnerId)?.agent?.name} 获胜！
              赢得 {gameResult.punishPoints} 积分
            </p>

            <h4 style={{ margin: "0 0 10px 0" }}>所有人的骰子：</h4>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {gameResult.allDice.map((item: any) => (
                <div key={item.agent.id} style={{ textAlign: "center" }}>
                  <p style={{ margin: "0 0 5px 0", fontWeight: "bold" }}>{item.agent.name}</p>
                  <div style={{ display: "flex", gap: "5px" }}>
                    {item.dice.map((point: number, index: number) => (
                      <div key={index} style={{ 
                        width: "30px", height: "30px", 
                        border: "1px solid #000", borderRadius: "4px", 
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "16px", fontWeight: "bold"
                      }}>
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {isCreator && (
              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <button 
                  onClick={handleRestart} 
                  style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "16px" }}
                >
                  重新开局
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectRoute>
  );
}