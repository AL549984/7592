"use client";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProtectRoute({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 未登录则跳转到登录页
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Agent身份验证中...</div>;
  }

  return <>{children}</>;
}