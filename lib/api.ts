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
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token = sessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Session-Mode": "tab",
  };
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(API + path, {
    method,
    credentials: "omit",
    cache: "no-store",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new ApiError(
      "Không kết nối được backend. Kiểm tra terminal backend và địa chỉ BACKEND_URL.",
      0,
    );
  });
  const data = (await r.json().catch(() => {
    throw new ApiError(
      r.status === 403
        ? "Địa chỉ web chưa được cho phép. Kiểm tra ALLOWED_ORIGINS trong .env.backend."
        : "Backend chưa trả về JSON. Kiểm tra backend cổng 8000 và BACKEND_URL trong .env.local.",
      r.status,
    );
  })) as { detail?: unknown; access_token?: string };
  if (!r.ok) {
    if (r.status === 401 && typeof window !== "undefined")
      sessionStorage.removeItem(SESSION_KEY);
    throw new ApiError(
      typeof data.detail === "string"
        ? data.detail
        : "Thông tin chưa hợp lệ. Tên đăng nhập dùng 3–24 chữ không dấu, số hoặc dấu gạch dưới; mật khẩu từ 8 ký tự.",
      r.status,
    );
  }
  if (typeof window !== "undefined") {
    if (
      (path === "/auth/login" || path === "/auth/register") &&
      data.access_token
    )
      sessionStorage.setItem(SESSION_KEY, data.access_token);
    if (path === "/auth/logout") {
      sessionStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new Event("kyvan-session-changed"));
    }
  }
  return data as T;
}
