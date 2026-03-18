/**
 * POST /api/secondme/connect
 * 用 smc-... 授权码换取 sm-... token，保存到当前用户的数据库记录
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForToken } from "@/lib/secondme-api";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code: string | undefined = body?.code;

  if (!code || typeof code !== "string" || !code.startsWith("smc-")) {
    return NextResponse.json(
      { error: "请提供有效的授权码（格式：smc-...）" },
      { status: 400 }
    );
  }

  try {
    const { accessToken } = await exchangeCodeForToken(code);

    await prisma.secondMeAgent.update({
      where: { id: session.user.id },
      data: { smApiToken: accessToken },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/secondme/connect
 * 断开 SecondMe API 连接（清除已保存的 token）
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  await prisma.secondMeAgent.update({
    where: { id: session.user.id },
    data: { smApiToken: null },
  });

  return NextResponse.json({ success: true });
}

/**
 * GET /api/secondme/connect
 * 检查当前用户是否已连接 SecondMe API
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const agent = await prisma.secondMeAgent.findUnique({
    where: { id: session.user.id },
    select: { smApiToken: true },
  });

  return NextResponse.json({ connected: !!agent?.smApiToken });
}
