// 固定配置：禁用静态预渲染，必须放在import之后
export const dynamic = 'force-dynamic';

import NextAuth from "next-auth";
import type { AuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import axios from "axios";
import { prisma } from "@/lib/prisma";

// 读取环境变量
const SECONDME_CLIENT_ID = process.env.SECONDME_CLIENT_ID!;
const SECONDME_CLIENT_SECRET = process.env.SECONDME_CLIENT_SECRET!;
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
          // 1. 用code获取Second Me的Token
          const tokenRes = await axios.post(SECONDME_TOKEN_URL, {
            client_id: SECONDME_CLIENT_ID,
            client_secret: SECONDME_CLIENT_SECRET,
            code: credentials.code,
            grant_type: "authorization_code",
            redirect_uri: `${process.env.NEXT_PUBLIC_URL}/auth/callback`,
          });

          const { access_token } = tokenRes.data;
          if (!access_token) return null;

          // 2. 用Token获取Agent的信息
          const userRes = await axios.get(SECONDME_USER_URL, {
            headers: { Authorization: `Bearer ${access_token}` },
          });

          const agentData = userRes.data;
          const { id: secondMeId, name, avatar } = agentData;
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
                  avatar: avatar || undefined 
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
                avatar: avatar || agent.avatar || undefined 
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