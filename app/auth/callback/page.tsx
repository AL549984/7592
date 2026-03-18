"use client";
import { useEffect, Suspense, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // 防止 React StrictMode 开发模式双重调用消耗同一个 OAuth code
    if (hasProcessed.current) return;

    if (!searchParams) {
      router.push("/login?error=no_params");
      return;
    }
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("Second Me 授权失败：", error);
      router.push("/login?error=oauth_denied");
      return;
    }

    if (!code) {
      router.push("/login?error=no_code");
      return;
    }

    hasProcessed.current = true;

    // 用授权码完成 NextAuth 登录（redirect:false 以便客户端捕获错误）
    signIn("secondme", { code, redirect: false }).then((result) => {
      if (result?.ok && !result.error) {
        router.push("/");
      } else {
        console.error("登录失败：", result?.error);
        router.push(`/login?error=${encodeURIComponent(result?.error || "auth_failed")}`);
      }
    });
  }, [searchParams, router]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      gap: "16px",
      fontFamily: "sans-serif",
    }}>
      <p style={{ fontSize: "18px", color: "#374151" }}>正在登录中，请稍候...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "sans-serif",
      }}>
        加载中...
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
