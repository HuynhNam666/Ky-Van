"use client";
import type { CSSProperties } from "react";
import "./rank-profile.css";
export type RankTier = { index: number; name: string; minimum: number; color: string; stars: number; ornament: number };
export type RankProfile = { user_id: number; points: number; elo: number; wins: number; draws: number; losses: number; avatar_id: string; avatar_url: string; tier: RankTier; next_tier: RankTier | null; progress: number };
export type RankResult = { eligible: boolean; reason: string; players: Record<string, {points: number; elo: number; promoted: boolean; tier: string}> };
export type RankedRoom = { red_profile?: RankProfile | null; black_profile?: RankProfile | null; rank_result?: RankResult | null };
export function RankAvatar({ profile, overlay = false }: { profile?: RankProfile | null; overlay?: boolean }) {
  if (!profile) return null;
  return <span className={`kv-rank-frame kv-rank-${profile.tier.index}${overlay ? " kv-rank-overlay" : ""}`} style={{"--rank-color": profile.tier.color} as CSSProperties} title={`${profile.tier.name} · ${profile.points.toLocaleString("vi-VN")} điểm`}>
    <img src={profile.avatar_url} alt={`Avatar ${profile.tier.name}`} width={160} height={160} />
    <span className="kv-rank-gem" aria-hidden="true">{profile.tier.index >= 15 ? "♛" : profile.tier.index >= 8 ? "✦" : "◆"}</span>
  </span>;
}
export function RankLabel({profile}:{profile?: RankProfile | null}) {
  if (!profile) return null;
  return <span className="kv-rank-label" style={{"--rank-color":profile.tier.color} as CSSProperties}>
    <b>{profile.tier.name}</b><span aria-label={`${profile.tier.stars} sao`}>{"★".repeat(profile.tier.stars)}</span>
    <small>{profile.points.toLocaleString("vi-VN")} điểm · Elo {profile.elo}</small>
  </span>;
}
export function RankMatchResult({result,userId}:{result?: RankResult|null;userId?:number}) {
  if(!result || !userId) return null;
  const me=result.players[String(userId)];
  return <aside className="kv-rank-result" role="status">{!result.eligible ? result.reason : me && <>
    <strong>{me.promoted ? `✦ Thăng hạng: ${me.tier}! Avatar mới đã mở khóa.` : "Đã cập nhật cấp bậc"}</strong>
    <span> +{me.points} điểm cấp bậc · Elo {me.elo>=0?"+":""}{me.elo}</span> <a href="/ho-so">Xem phần thưởng →</a>
  </>}</aside>;
}
