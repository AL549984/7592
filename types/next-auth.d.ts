import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    secondMeId: string;
    name: string;
    avatar?: string;
    points: number;
  }

  interface Session {
    user: {
      id: string;
      secondMeId: string;
      name: string;
      avatar?: string;
      points: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    secondMeId: string;
    name: string;
    avatar?: string;
    points: number;
  }
}