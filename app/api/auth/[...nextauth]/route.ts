// 固定配置：禁用静态预渲染，必须放在import之后
export const dynamic = 'force-dynamic';

import NextAuth from "next-auth";
import type { AuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import axios from "axios";
import { prisma } from "@/lib/prisma";

// 读取环境变量
const SECONDME_TOKEN_URL = process.env.SECONDME_TOKEN_URL!;
const SECONDME_USER_URL = process.env.SECONDME_USER_URL!;

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      id: "secondme",
      name: "Second Me",
      credentials: {
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.code) return null;

        try {
          // 1. 用 smc-... 授权码换取 sm-... token（JSON 格式，参见 SKILL.md）
          const tokenRes = await axios.post(
            SECONDME_TOKEN_URL,
            { code: credentials.code },
            { headers: { "Content-Type": "application/json" } },
          );

          const tokenResult = tokenRes.data;
          if (tokenResult.code !== 0 || !tokenResult.data?.accessToken) {
            throw new Error(`Token exchange failed: ${tokenResult.message}`);
          }
          const { accessToken } = tokenResult.data;

          // 2. 用 Token 获取 Agent 的个人资料
          const userRes = await axios.get(SECONDME_USER_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          const userResult = userRes.data;
          if (userResult.code !== 0 || !userResult.data) {
            throw new Error(`User info failed: ${userResult.message}`);
          }
          const agentData = userResult.data;
          // 优先使用 id 字段，其次使用 originRoute 作为唯一标识
          const secondMeId = agentData.id ?? agentData.originRoute;
          const name = agentData.name;
          const avatarUrl = agentData.avatar ?? agentData.avatarUrl;
          if (!secondMeId || !name) return null;

          // 3. 同步Agent信息到数据库，不存在则创建
          let agent = await prisma.secondMeAgent.findUnique({
            where: { secondMeId },
          });

          if (!agent) {
            agent = await prisma.$transaction(async (tx) => {
              const newAgent = await tx.secondMeAgent.create({
                data: { 
                  secondMeId, 
                  name, 
                  avatar: avatarUrl || undefined,
                  smApiToken: accessToken,
                },
              });
              await tx.gameRecord.create({
                data: { agentId: newAgent.id },
              });
              return newAgent;
            });
          } else {
            agent = await prisma.secondMeAgent.update({
              where: { secondMeId },
              data: { 
                name, 
                avatar: avatarUrl || agent.avatar || undefined,
                smApiToken: accessToken,
              },
            });
          }

          // 4. 返回符合类型要求的User对象
          return {
            id: agent.id,
            name: agent.name,
            email: secondMeId,
            image: agent.avatar,
            secondMeId: secondMeId,
            points: agent.points,
          } as User;
        } catch (error) {
          console.error("Second Me OAuth 登录失败：", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.secondMeId = (user as any).secondMeId;
        token.name = user.name;
        token.avatar = user.image ?? undefined;
        token.points = (user as any).points;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        secondMeId: token.secondMeId as string,
        name: token.name as string,
        avatar: token.avatar as string | undefined,
        points: token.points as number,
      };
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };