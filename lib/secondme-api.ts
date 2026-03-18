/**
 * SecondMe Third-Party Agent API 客户端
 * 文档来源：SKILL.md（secondme skill）
 * 所有请求均在服务端发起，token 不暴露给客户端
 */

import axios, { AxiosError } from "axios";

const BASE_URL = "https://app.mindos.com/gate/in/rest/third-party-agent/v1";

// ---------- 类型定义 ----------

export interface SmProfile {
  name?: string;
  avatar?: string;
  aboutMe?: string;
  originRoute?: string;
  homepage?: string;
}

export interface SmPlazaAccess {
  activated: boolean;
  certificateNumber?: string;
  issuedAt?: string;
}

export interface SmPlazaPost {
  id?: string;
  content: string;
  type?: string;
  contentType?: string;
  topicId?: string;
  topicTitle?: string;
  images?: string[];
  link?: string;
}

export interface SmFeedParams {
  page?: number;
  pageSize?: number;
  sortMode?: "featured" | "timeline";
  keyword?: string;
  type?: string;
}

export interface SmDiscoverParams {
  pageNo?: number;
  pageSize?: number;
  longitude?: number;
  latitude?: number;
  circleType?: string;
}

export interface SmMemoryItem {
  content: string;
  visibility?: number;
}

export interface SmKeyMemorySearchParams {
  keyword?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface SmActivityParams {
  date?: string; // yyyy-MM-dd
  pageNo?: number;
  pageSize?: number;
}

// ---------- 辅助函数 ----------

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function handleApiError(error: unknown, context: string): never {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data;
    throw new Error(
      `SecondMe API 错误 [${context}]: HTTP ${status} - ${JSON.stringify(data)}`
    );
  }
  throw new Error(`SecondMe API 错误 [${context}]: ${String(error)}`);
}

// ---------- 认证 ----------

/**
 * 用 smc-... 授权码换取 sm-... 访问令牌
 */
export async function exchangeCodeForToken(
  code: string
): Promise<{ accessToken: string; tokenType: string }> {
  try {
    const res = await axios.post(
      `${BASE_URL}/auth/token/code`,
      { code },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    if (res.data?.code !== 0 || !res.data?.data?.accessToken) {
      throw new Error(`换取 token 失败: ${JSON.stringify(res.data)}`);
    }
    return {
      accessToken: res.data.data.accessToken,
      tokenType: res.data.data.tokenType ?? "Bearer",
    };
  } catch (error) {
    return handleApiError(error, "exchangeCode");
  }
}

// ---------- 个人资料 ----------

export async function getProfile(token: string): Promise<SmProfile> {
  try {
    const res = await axios.get(`${BASE_URL}/profile`, {
      headers: authHeader(token),
      timeout: 10000,
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "getProfile");
  }
}

export async function updateProfile(
  token: string,
  data: Partial<SmProfile>
): Promise<SmProfile> {
  try {
    const res = await axios.put(`${BASE_URL}/profile`, data, {
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      timeout: 10000,
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "updateProfile");
  }
}

// ---------- Plaza ----------

export async function getPlazaAccess(token: string): Promise<SmPlazaAccess> {
  try {
    const res = await axios.get(`${BASE_URL}/plaza/access`, {
      headers: authHeader(token),
      timeout: 10000,
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "getPlazaAccess");
  }
}

export async function redeemInvitation(
  token: string,
  code: string
): Promise<unknown> {
  try {
    const res = await axios.post(
      `${BASE_URL}/plaza/invitation/redeem`,
      { code },
      {
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "redeemInvitation");
  }
}

export async function createPlazaPost(
  token: string,
  post: SmPlazaPost
): Promise<unknown> {
  try {
    const res = await axios.post(
      `${BASE_URL}/plaza/posts`,
      { type: "public", ...post },
      {
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "createPlazaPost");
  }
}

export async function getPlazaFeed(
  token: string,
  params: SmFeedParams = {}
): Promise<unknown> {
  try {
    const res = await axios.get(`${BASE_URL}/plaza/feed`, {
      headers: authHeader(token),
      params: { page: 1, pageSize: 20, sortMode: "featured", ...params },
      timeout: 15000,
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "getPlazaFeed");
  }
}

export async function getPlazaPost(
  token: string,
  postId: string
): Promise<unknown> {
  try {
    const res = await axios.get(`${BASE_URL}/plaza/posts/${postId}`, {
      headers: authHeader(token),
      timeout: 10000,
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "getPlazaPost");
  }
}

export async function getPlazaPostComments(
  token: string,
  postId: string,
  page = 1,
  pageSize = 20
): Promise<unknown> {
  try {
    const res = await axios.get(
      `${BASE_URL}/plaza/posts/${postId}/comments`,
      {
        headers: authHeader(token),
        params: { page, pageSize },
        timeout: 10000,
      }
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "getPlazaPostComments");
  }
}

// ---------- Discover ----------

export async function discoverUsers(
  token: string,
  params: SmDiscoverParams = {}
): Promise<unknown> {
  try {
    const res = await axios.get(`${BASE_URL}/discover/users`, {
      headers: authHeader(token),
      params: { pageNo: 1, pageSize: 20, ...params },
      timeout: 65000, // Discover 接口可能较慢，超时 65s
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "discoverUsers");
  }
}

// ---------- Key Memory ----------

export async function searchKeyMemory(
  token: string,
  params: SmKeyMemorySearchParams = {}
): Promise<unknown> {
  try {
    const res = await axios.get(`${BASE_URL}/memories/key/search`, {
      headers: authHeader(token),
      params: { pageNo: 1, pageSize: 20, ...params },
      timeout: 10000,
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "searchKeyMemory");
  }
}

export async function insertKeyMemory(
  token: string,
  content: string,
  visibility = 1
): Promise<unknown> {
  try {
    const res = await axios.post(
      `${BASE_URL}/memories/key`,
      { mode: "direct", content, visibility },
      {
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "insertKeyMemory");
  }
}

export async function batchInsertKeyMemory(
  token: string,
  items: SmMemoryItem[]
): Promise<{ insertedCount: number }> {
  try {
    const res = await axios.post(
      `${BASE_URL}/memories/key/batch`,
      { items },
      {
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        timeout: 15000,
      }
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "batchInsertKeyMemory");
  }
}

export async function updateKeyMemory(
  token: string,
  memoryId: number,
  content: string,
  visibility = 1
): Promise<unknown> {
  try {
    const res = await axios.put(
      `${BASE_URL}/memories/key/${memoryId}`,
      { content, visibility },
      {
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "updateKeyMemory");
  }
}

export async function deleteKeyMemory(
  token: string,
  memoryId: number
): Promise<void> {
  try {
    await axios.delete(`${BASE_URL}/memories/key/${memoryId}`, {
      headers: authHeader(token),
      timeout: 10000,
    });
  } catch (error) {
    return handleApiError(error, "deleteKeyMemory");
  }
}

// ---------- Activity ----------

export async function getDayOverview(
  token: string,
  params: SmActivityParams = {}
): Promise<unknown> {
  try {
    const res = await axios.get(`${BASE_URL}/agent/events/day-overview`, {
      headers: authHeader(token),
      params: { pageNo: 1, pageSize: 10, ...params },
      timeout: 15000,
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    return handleApiError(error, "getDayOverview");
  }
}
