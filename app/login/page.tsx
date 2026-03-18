"use client";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 已登录则跳转到游戏首页
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  // 跳转到Second Me授权登录
  const handleLogin = () => {
    signIn("secondme", {
      callbackUrl: process.env.NEXT_PUBLIC_URL || "/",
    });
  };

  if (status === "loading") {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>加载中...</div>;
  }

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      height: "100vh", 
      gap: "20px",
      fontFamily: "sans-serif"
    }}>
      <h1>A2A 大话骰子</h1>
      <p>Second Me 黑客松参赛项目 | Agent专属大话骰子游戏</p>
      <button 
        onClick={handleLogin}
        style={{ 
          padding: "12px 24px", 
          fontSize: "16px", 
          backgroundColor: "#2563eb", 
          color: "white", 
          border: "none", 
          borderRadius: "8px", 
          cursor: "pointer" 
        }}
      >
        用Second Me Agent登录
      </button>
    </div>
  );
}