/**
 * GET    /api/secondme/profile  - 获取 SecondMe 个人资料
 * PUT    /api/secondme/profile  - 更新 SecondMe 个人资料
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getProfile, updateProfile } from "@/lib/secondme-api";

async function getToken(userId: string): Promise<string | null> {
  const agent = await prisma.secondMeAgent.findUnique({
    where: { id: userId },
    select: { smApiToken: true },
  });
  return agent?.smApiToken ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const token = await getToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "请先连接 SecondMe API" }, { status: 403 });
  }

  try {
    const profile = await getProfile(token);
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const token = await getToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "请先连接 SecondMe API" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  // 只允许更新这些字段
  const { name, avatar, aboutMe, originRoute } = body;
  const data: Record<string, string> = {};
  if (name !== undefined) data.name = name;
  if (avatar !== undefined) data.avatar = avatar;
  if (aboutMe !== undefined) data.aboutMe = aboutMe;
  if (originRoute !== undefined) data.originRoute = originRoute;

  try {
    const profile = await updateProfile(token, data);
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
