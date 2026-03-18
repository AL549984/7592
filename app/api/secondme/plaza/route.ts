/**
 * GET  /api/secondme/plaza         - Plaza 信息流（浏览/搜索）
 * POST /api/secondme/plaza         - 发布 Plaza 帖子
 * GET  /api/secondme/plaza?access=1 - 检查 Plaza 激活状态
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import {
  getPlazaAccess,
  redeemInvitation,
  createPlazaPost,
  getPlazaFeed,
} from "@/lib/secondme-api";

async function getToken(userId: string): Promise<string | null> {
  const agent = await prisma.secondMeAgent.findUnique({
    where: { id: userId },
    select: { smApiToken: true },
  });
  return agent?.smApiToken ?? null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const token = await getToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "请先连接 SecondMe API" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  // 仅检查激活状态
  if (searchParams.get("access") === "1") {
    try {
      const access = await getPlazaAccess(token);
      return NextResponse.json(access);
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  // 获取 feed 或关键词搜索
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);
  const keyword = searchParams.get("keyword") ?? undefined;
  const sortMode = (searchParams.get("sortMode") as "featured" | "timeline") ?? "featured";
  const type = searchParams.get("type") ?? undefined;

  try {
    const feed = await getPlazaFeed(token, { page, pageSize, keyword, sortMode, type });
    return NextResponse.json(feed);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const token = await getToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "请先连接 SecondMe API" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // 核销邀请码
  if (body?.action === "redeem" && body?.code) {
    try {
      const result = await redeemInvitation(token, body.code);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 400 });
    }
  }

  // 先检查 Plaza 激活状态
  try {
    const access = await getPlazaAccess(token);
    if (!access.activated) {
      return NextResponse.json(
        { error: "Plaza 尚未激活，请先核销邀请码", activated: false },
        { status: 403 }
      );
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }

  // 发布帖子
  const { content, contentType, type, topicId, topicTitle, images, link } = body;
  if (!content) {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
  }

  // contentType 校验：只允许合法值
  const validContentTypes = ["discussion", "ama", "info"];
  const safeContentType =
    contentType && validContentTypes.includes(contentType)
      ? contentType
      : "discussion";

  try {
    const post = await createPlazaPost(token, {
      content,
      contentType: safeContentType,
      type: type ?? "public",
      topicId,
      topicTitle,
      images,
      link,
    });
    return NextResponse.json(post);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
