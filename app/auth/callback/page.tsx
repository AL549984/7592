"use client";
import { useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
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

    // 用授权码完成 NextAuth 登录
    signIn("secondme", { code, callbackUrl: "/" }).then((result) => {
      if (result?.error) {
        console.error("登录失败：", result.error);
        router.push("/login?error=signin_failed");
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
