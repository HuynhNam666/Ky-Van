"""Additive rank, Elo and avatar module. No existing tables or balances changed."""
import json
from pathlib import Path
from datetime import datetime, timezone
from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import ForeignKey, Integer, String, JSON, select, func
from sqlalchemy.orm import Mapped, mapped_column
from .main import Base, User, Room, engine, app, Current, DB

CATALOG = json.loads(Path(__file__).with_name('rank_catalog.json').read_text(encoding='utf-8'))
TIERS = CATALOG['tiers']
AVATARS = {a['id']: a for a in CATALOG['avatars']}

class PlayerRank(Base):
    __tablename__ = 'player_ranks_v1'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    points: Mapped[int] = mapped_column(Integer, default=1000)
    elo: Mapped[int] = mapped_column(Integer, default=1000)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    draws: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    avatar_id: Mapped[str] = mapped_column(String(32), default='classic')

class RankSettlement(Base):
    __tablename__ = 'rank_settlements_v1'
    code: Mapped[str] = mapped_column(ForeignKey('rooms.code'), primary_key=True)
    result: Mapped[dict] = mapped_column(JSON)
    stamp: Mapped[str] = mapped_column(String(40))

Base.metadata.create_all(engine)

def tier_for(points):
    return next(t for t in reversed(TIERS) if points >= t['minimum'])

def profile(s, uid):
    if uid is None: return None
    p = s.get(PlayerRank, uid)
    points = p.points if p else 1000
    tier = tier_for(points)
    nxt = TIERS[tier['index'] + 1] if tier['index'] + 1 < len(TIERS) else None
    avatar_id = p.avatar_id if p else 'classic'
    return dict(user_id=uid, points=points, elo=p.elo if p else 1000,
                wins=p.wins if p else 0, draws=p.draws if p else 0,
                losses=p.losses if p else 0, avatar_id=avatar_id,
                avatar_url=AVATARS[avatar_id]['url'], tier=tier, next_tier=nxt,
                progress=1 if nxt is None else (points-tier['minimum'])/(nxt['minimum']-tier['minimum']))

def locked_player(s, uid):
    s.scalar(select(User).where(User.id == uid).with_for_update())
    p = s.get(PlayerRank, uid)
    if p is None:
        p = PlayerRank(user_id=uid, points=1000, elo=1000, wins=0, draws=0, losses=0, avatar_id='classic')
        s.add(p); s.flush()
    return p

def settle_rank(s, room):
    # Called inside the existing match transaction, after coin settlement.
    if room.status not in ('finished', 'draw') or not room.black_id: return
    s.scalar(select(Room).where(Room.code == room.code).with_for_update())
    if s.get(RankSettlement, room.code): return
    if room.status == 'finished' and room.winner not in ('r', 'b'): return
    # Ignore cancelled/aborted games. Both players must actually participate.
    counts = {side: sum(str(m.get('piece', ''))[:1] == side for m in (room.history or [])) for side in ('r', 'b')}
    eligible = min(counts.values()) >= 3
    result = {'eligible': eligible, 'reason': '' if eligible else 'Mỗi bên cần tự đi ít nhất 3 nước để tính cấp bậc.', 'players': {}}
    if eligible:
        players = {uid: locked_player(s, uid) for uid in sorted((room.red_id, room.black_id))}
        red, black = players[room.red_id], players[room.black_id]
        score = .5 if room.status == 'draw' else (1 if room.winner == 'r' else 0)
        expected = 1 / (1 + 10 ** (max(-4000, min(4000, black.elo-red.elo)) / 400))
        delta = round(32 * (score-expected))
        for p, actual, change in ((red, score, delta), (black, 1-score, -delta)):
            before = tier_for(p.points)
            gained = 40 if actual == 1 else (10 if actual == .5 else 0)
            old_elo = p.elo
            p.points += gained; p.elo = max(100, p.elo + change)
            if actual == 1: p.wins += 1
            elif actual == .5: p.draws += 1
            else: p.losses += 1
            after = tier_for(p.points)
            result['players'][str(p.user_id)] = dict(points=gained, elo=p.elo-old_elo,
                promoted=after['index'] > before['index'], tier=after['name'])
    s.add(RankSettlement(code=room.code, result=result, stamp=datetime.now(timezone.utc).isoformat()))
    s.flush()

@app.get('/api/progression/catalog')
def rank_catalog(): return CATALOG

@app.get('/api/progression/me')
def rank_me(u: Current, s: DB): return profile(s, u.id)

@app.get('/api/progression/leaderboard')
def leaderboard(u: Current, s: DB, limit: int = 50):
    """Bảng Phong Vân: xếp theo điểm cấp bậc, rồi Elo, rồi người tham gia sớm hơn. Chỉ lộ thông tin công khai của hồ sơ."""
    limit = max(1, min(100, limit))
    order = (PlayerRank.points.desc(), PlayerRank.elo.desc(), PlayerRank.user_id.asc())
    rows = s.execute(select(PlayerRank, User.username).join(User, User.id == PlayerRank.user_id).order_by(*order).limit(limit)).all()
    def entry(rank, p, name):
        return dict(rank=rank, user_id=p.user_id, username=name, avatar_url=AVATARS[p.avatar_id]['url'] if p.avatar_id in AVATARS else AVATARS['classic']['url'],
                    tier=tier_for(p.points), points=p.points, elo=p.elo)
    items = [entry(i + 1, p, name) for i, (p, name) in enumerate(rows)]
    mine = s.get(PlayerRank, u.id)
    me = None
    if mine is not None:
        ahead = s.scalar(select(func.count()).select_from(PlayerRank).where(
            (PlayerRank.points > mine.points)
            | ((PlayerRank.points == mine.points) & (PlayerRank.elo > mine.elo))
            | ((PlayerRank.points == mine.points) & (PlayerRank.elo == mine.elo) & (PlayerRank.user_id < mine.user_id))))
        me = entry(ahead + 1, mine, u.username)
    total = s.scalar(select(func.count()).select_from(PlayerRank))
    return dict(items=items, me=me, total=total)

class AvatarChoice(BaseModel):
    avatar_id: str = Field(min_length=1, max_length=32)

@app.post('/api/progression/avatar')
def choose_avatar(data: AvatarChoice, u: Current, s: DB):
    avatar = AVATARS.get(data.avatar_id)
    if avatar is None: raise HTTPException(404, 'Avatar không tồn tại.')
    p = locked_player(s, u.id)
    if tier_for(p.points)['index'] < avatar['required_tier']:
        raise HTTPException(403, 'Avatar đang khóa. Hãy đạt cấp ' + TIERS[avatar['required_tier']]['name'] + '.')
    p.avatar_id = avatar['id']; s.commit()
    return profile(s, u.id)

def install_rankings(namespace):
    """Decorate runtime entry points; retain the original functions and their behavior."""
    original_settle = namespace['settle_coins']
    original_room_data = namespace['room_data']
    def settle_with_rank(s, r):
        original_settle(s, r)
        settle_rank(s, r)
    def room_with_rank(r, s):
        data = original_room_data(r, s)
        data['red_profile'] = profile(s, r.red_id)
        data['black_profile'] = profile(s, r.black_id)
        settled = s.get(RankSettlement, r.code)
        data['rank_result'] = settled.result if settled else None
        return data
    namespace['settle_coins'] = settle_with_rank
    namespace['room_data'] = room_with_rank
