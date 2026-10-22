import type { Board, Move, Side } from "@/lib/chess";
export const API = process.env.NEXT_PUBLIC_API_URL || "/api";
export type User = { id: number; username: string };
export type Room = {
  code: string;
  name: string;
  red_id: number;
  black_id: number | null;
  red_name: string;
  black_name: string | null;
  board: Board;
  turn: Side;
  history: Move[];
  status: string;
  winner?: Side | null;
  version: number;
  total_seconds?: number;
  move_seconds?: number;
  stake?: number;
  coins?: {
    stake: number;
    pot: number;
    settled: boolean;
    red_payout: number;
    black_payout: number;
  };
  clock?: {
    total_seconds: number;
    move_seconds: number;
    red_remaining: number;
    black_remaining: number;
    turn_started: number | null;
    finish_reason: "total_timeout" | "move_timeout" | null;
  };
  quick?: boolean;
  red_ready?: boolean;
  black_ready?: boolean;
  ready_deadline?: number;
  server_time?: number;
  draw_by?: number | null;
  cancel_reason?: string | null;
};
export type Saved = {
  id: string;
  name: string;
  date: string;
  board: Board;
  turn: Side;
  history: Move[];
  mode?: string;
};
export type Chat = { username: string; text: string; time?: string };
export type Invite = { id: number; code: string; sender: string };
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
// sessionStorage is isolated by browser tab; no token is put in URLs.
export const SESSION_KEY = "kyvan.tab-session.v1";
export function sessionToken() {
  return typeof window === "undefined"
    ? null
    : sessionStorage.getItem(SESSION_KEY);
}
// --- HAM API CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
// ORIGINAL | export async function api<T = unknown>(
// ORIGINAL |   path: string,
// ORIGINAL |   method = "GET",
// ORIGINAL |   body?: unknown,
// ORIGINAL | ): Promise<T> {
// ORIGINAL |   const token = sessionToken();
// ORIGINAL |   const headers: Record<string, string> = {
// ORIGINAL |     "Content-Type": "application/json",
// ORIGINAL |     "X-Session-Mode": "tab",
// ORIGINAL |   };
// ORIGINAL |   if (token) headers.Authorization = "Bearer " + token;
// ORIGINAL |   const r = await fetch(API + path, {
// ORIGINAL |     method,
// ORIGINAL |     credentials: "omit",
// ORIGINAL |     cache: "no-store",
// ORIGINAL |     headers,
// ORIGINAL |     body: body ? JSON.stringify(body) : undefined,
// ORIGINAL |   }).catch(() => {
// ORIGINAL |     throw new ApiError(
// ORIGINAL |       "Không kết nối được backend. Kiểm tra terminal backend và địa chỉ BACKEND_URL.",
// ORIGINAL |       0,
// ORIGINAL |     );
// ORIGINAL |   });
// ORIGINAL |   const data = (await r.json().catch(() => {
// ORIGINAL |     throw new ApiError(
// ORIGINAL |       r.status === 403
// ORIGINAL |         ? "Địa chỉ web chưa được cho phép. Kiểm tra ALLOWED_ORIGINS trong .env.backend."
// ORIGINAL |         : "Backend chưa trả về JSON. Kiểm tra backend cổng 8000 và BACKEND_URL trong .env.local.",
// ORIGINAL |       r.status,
// ORIGINAL |     );
// ORIGINAL |   })) as { detail?: unknown; access_token?: string };
// ORIGINAL |   if (!r.ok) {
// ORIGINAL |     if (r.status === 401 && typeof window !== "undefined")
// ORIGINAL |       sessionStorage.removeItem(SESSION_KEY);
// ORIGINAL |     throw new ApiError(
// ORIGINAL |       typeof data.detail === "string"
// ORIGINAL |         ? data.detail
// ORIGINAL |         : "Thông tin chưa hợp lệ. Tên đăng nhập dùng 3–24 chữ không dấu, số hoặc dấu gạch dưới; mật khẩu từ 8 ký tự.",
// ORIGINAL |       r.status,
// ORIGINAL |     );
// ORIGINAL |   }
// ORIGINAL |   if (typeof window !== "undefined") {
// ORIGINAL |     if (
// ORIGINAL |       (path === "/auth/login" || path === "/auth/register") &&
// ORIGINAL |       data.access_token
// ORIGINAL |     )
// ORIGINAL |       sessionStorage.setItem(SESSION_KEY, data.access_token);
// ORIGINAL |     if (path === "/auth/logout") {
// ORIGINAL |       sessionStorage.removeItem(SESSION_KEY);
// ORIGINAL |       window.dispatchEvent(new Event("kyvan-session-changed"));
// ORIGINAL |     }
// ORIGINAL |   }
// ORIGINAL |   return data as T;
// ORIGINAL | }
// --- PHAN CAP NHAT DANG SU DUNG ---
// Cached identity is only for display. All protected actions still use server auth.
export const PROFILE_KEY = "kyvan.tab-profile.v1";
export function cachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const profile = JSON.parse(sessionStorage.getItem(PROFILE_KEY) || "null");
    return profile?.token === sessionToken() &&
      typeof profile?.user?.id === "number" &&
      typeof profile?.user?.username === "string"
      ? profile.user
      : null;
  } catch {
    return null;
  }
}
const reads = new Map<string, Promise<unknown>>();
export function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token = sessionToken();
  const key = JSON.stringify([token, path]);
  if (method === "GET") {
    const pending = reads.get(key);
    if (pending) return pending as Promise<T>;
    // Reuse a recently verified identity when navigating between pages.
    if (path === "/auth/me" && cachedUser()) {
      try {
        const profile = JSON.parse(
          sessionStorage.getItem(PROFILE_KEY) || "null",
        );
        if (Date.now() - profile.verifiedAt < 10000)
          return Promise.resolve(profile.user as T);
      } catch {
        /* Revalidate with the API. */
      }
    }
  }
  const task = request<T>(path, method, body, token);
  if (method === "GET") {
    reads.set(key, task);
    const clear = () => {
      if (reads.get(key) === task) reads.delete(key);
    };
    void task.then(clear, clear);
  }
  return task;
}
async function request<T>(
  path: string,
  method: string,
  body: unknown,
  token: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Session-Mode": "tab",
  };
  if (token) headers.Authorization = "Bearer " + token;
  let response: Response | undefined;
  // Retry only reads; creating rooms or making moves must never be repeated here.
  const attempts = method === "GET" ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      response = await fetch(API + path, {
        method,
        credentials: "omit",
        cache: "no-store",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      if (
        ![502, 503, 504].includes(response.status) ||
        attempt === attempts - 1
      )
        break;
    } catch {
      if (attempt === attempts - 1)
        throw new ApiError(
          method === "GET"
            ? "Kết nối máy chủ đang chậm hoặc gián đoạn. Phiên đăng nhập được giữ nguyên; vui lòng thử lại."
            : "Chưa nhận được phản hồi máy chủ. Hãy kiểm tra trạng thái trước khi thực hiện lại thao tác.",
          0,
        );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const r = response!;
  // Preserve the original invalid-JSON error behavior; never treat HTML as success.
  const data = (await r.json().catch(() => {
    throw new ApiError(
      r.status === 403
        ? "Địa chỉ web chưa được máy chủ cho phép."
        : "Máy chủ chưa trả về dữ liệu hợp lệ. Vui lòng thử lại; phiên đăng nhập được giữ nguyên.",
      r.status,
    );
  })) as {
    detail?: unknown;
    access_token?: string;
    id?: number;
    username?: string;
  };
  if (!r.ok) {
    // A late response from an old request must not erase a newer login.
    if (
      r.status === 401 &&
      path === "/auth/me" &&
      token === sessionToken() &&
      typeof window !== "undefined"
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(PROFILE_KEY);
    }
    throw new ApiError(
      typeof data.detail === "string"
        ? data.detail
        : "Thông tin chưa hợp lệ. Vui lòng kiểm tra và thử lại.",
      r.status,
    );
  }
  if (typeof window !== "undefined") {
    let currentToken = token;
    if (
      (path === "/auth/login" || path === "/auth/register") &&
      data.access_token
    ) {
      sessionStorage.setItem(SESSION_KEY, data.access_token);
      currentToken = data.access_token;
    }
    if (
      ["/auth/me", "/auth/login", "/auth/register"].includes(path) &&
      currentToken &&
      currentToken === sessionToken() &&
      typeof data.id === "number" &&
      typeof data.username === "string"
    ) {
      sessionStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          token: currentToken,
          user: { id: data.id, username: data.username },
          verifiedAt: Date.now(),
        }),
      );
    }
    if (path === "/auth/logout" && token === sessionToken()) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(PROFILE_KEY);
      window.dispatchEvent(new Event("kyvan-session-changed"));
    }
  }
  return data as T;
}
