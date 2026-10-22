"""Kỳ Viện FastAPI service. Run one worker; PostgreSQL is authoritative."""

import asyncio, hashlib, hmac, json, os, re, secrets, time

from collections import defaultdict, deque

from datetime import datetime, timezone, timedelta

from typing import Annotated

import jwt

from fastapi import FastAPI, Depends, HTTPException, Request, Response, WebSocket, WebSocketDisconnect

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import logging

from pydantic import BaseModel, Field

from sqlalchemy import create_engine, String, Integer, Text, JSON, ForeignKey, DateTime, select, or_, inspect, text, UniqueConstraint

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker, Session

from .chess import initial, other, legal, moved, has_moves, valid_position

DATABASE_URL = os.environ['DATABASE_URL']

SECRET = os.environ['JWT_SECRET']

if len(SECRET) < 32: raise RuntimeError('JWT_SECRET must contain at least 32 characters')

# --- MA CU DUOC GIU LAI DE DOI CHIEU (khong thuc thi) ---
# ORIGINAL | ORIGINS = [s.strip() for s in os.getenv('ALLOWED_ORIGINS','http://localhost:3000').split(',')]
# --- HET MA CU; PHAN CAP NHAT DANG SU DUNG O DUOI ---
ORIGINS = [value.strip().rstrip('/') for value in os.getenv('ALLOWED_ORIGINS','http://localhost:3000').split(',') if value.strip()]

COOKIE_SECURE = os.getenv('COOKIE_SECURE','true').lower() == 'true'

COOKIE_SAMESITE = os.getenv('COOKIE_SAMESITE','lax')

# How many reverse proxies in front of this API append to X-Forwarded-For (0 = ignore the header).

PROXY_HOPS = int(os.getenv('TRUSTED_PROXY_HOPS','0'))

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase): pass

class User(Base):

    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)

    username: Mapped[str] = mapped_column(String(24), unique=True, index=True)

    password: Mapped[str] = mapped_column(Text)

class Room(Base):

    __tablename__ = 'rooms'

    code: Mapped[str] = mapped_column(String(6), primary_key=True)

    name: Mapped[str] = mapped_column(String(60))

    red_id: Mapped[int] = mapped_column(ForeignKey('users.id'))

    black_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'), nullable=True)

    board: Mapped[list] = mapped_column(JSON)

    turn: Mapped[str] = mapped_column(String(1), default='r')

    history: Mapped[list] = mapped_column(JSON, default=list)

    positions: Mapped[list] = mapped_column(JSON, default=list)

    status: Mapped[str] = mapped_column(String(16), default='waiting')

    winner: Mapped[str | None] = mapped_column(String(1), nullable=True)

    version: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc))

    total_seconds: Mapped[int] = mapped_column(Integer, default=900)

    move_seconds: Mapped[int] = mapped_column(Integer, default=60)

    stake: Mapped[int] = mapped_column(Integer, default=100)

class Saved(Base):

    __tablename__ = 'saves'

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)

    data: Mapped[dict] = mapped_column(JSON)

class Message(Base):

    __tablename__ = 'messages'

    id: Mapped[int] = mapped_column(primary_key=True)

    room_code: Mapped[str] = mapped_column(ForeignKey('rooms.code'), index=True)

    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))

    text: Mapped[str] = mapped_column(String(1000))

    time: Mapped[str] = mapped_column(String(40))

class Invitation(Base):

    __tablename__ = 'invitations'

    __table_args__ = (UniqueConstraint('room_code','receiver_id'),)

    id: Mapped[int] = mapped_column(primary_key=True)

    room_code: Mapped[str] = mapped_column(ForeignKey('rooms.code'))

    sender_id: Mapped[int] = mapped_column(ForeignKey('users.id'))

    receiver_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)

# Matchmaking data is additive: existing rooms/users are never dropped.

class QuickMatch(Base):

    __tablename__ = 'quick_matches'

    code: Mapped[str] = mapped_column(ForeignKey('rooms.code'), primary_key=True)

    red_ready: Mapped[int] = mapped_column(Integer, default=0)

    black_ready: Mapped[int] = mapped_column(Integer, default=0)

    deadline: Mapped[float] = mapped_column()

    draw_by: Mapped[int | None] = mapped_column(Integer, nullable=True)

    cancel_reason: Mapped[str | None] = mapped_column(String(120), nullable=True)

class QuickQueue(Base):

    __tablename__ = 'quick_queue'

    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)

    heartbeat: Mapped[float] = mapped_column()

# A separate table preserves all existing room and matchmaking data.

class MatchClock(Base):

    __tablename__ = 'match_clocks'

    code: Mapped[str] = mapped_column(ForeignKey('rooms.code'), primary_key=True)

    total_seconds: Mapped[int] = mapped_column(Integer)

    move_seconds: Mapped[int] = mapped_column(Integer)

    red_remaining: Mapped[float] = mapped_column()

    black_remaining: Mapped[float] = mapped_column()

    turn_started: Mapped[float | None] = mapped_column(nullable=True)

    finish_reason: Mapped[str | None] = mapped_column(String(24), nullable=True)

class FriendRequest(Base):

    __tablename__='friend_requests'

    __table_args__=(UniqueConstraint('sender_id','receiver_id'),)

    id: Mapped[int]=mapped_column(primary_key=True)

    sender_id: Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)

    receiver_id: Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)

    created_at: Mapped[float]=mapped_column(default=time.time)

class Friendship(Base):

    __tablename__='friendships'

    __table_args__=(UniqueConstraint('user_low','user_high'),)

    id: Mapped[int]=mapped_column(primary_key=True)

    user_low: Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)

    user_high: Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)

    created_at: Mapped[float]=mapped_column(default=time.time)

class UserPresence(Base):

    __tablename__='user_presence'

    user_id: Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)

    seen_at: Mapped[float]=mapped_column()

Base.metadata.create_all(engine)

def migrate(eng=engine):

    # create_all never alters existing tables: add the columns introduced after the first release.

    with eng.begin() as c:

        if 'created_at' not in {x['name'] for x in inspect(c).get_columns('rooms')}:

            c.execute(text('ALTER TABLE rooms ADD COLUMN created_at '+DateTime(timezone=True).compile(dialect=eng.dialect)))

        cols={x['name'] for x in inspect(c).get_columns('rooms')}

        for name,sql in (('total_seconds','INTEGER NOT NULL DEFAULT 900'),('move_seconds','INTEGER NOT NULL DEFAULT 60'),('stake','INTEGER NOT NULL DEFAULT 100')):

            if name not in cols:c.execute(text(f'ALTER TABLE rooms ADD COLUMN {name} {sql}'))

migrate()

# --- MA CU DUOC GIU LAI DE DOI CHIEU (khong thuc thi) ---
# ORIGINAL | app = FastAPI(title='Kỳ Viện API', version='1.0.0')
# --- HET MA CU; PHAN CAP NHAT DANG SU DUNG O DUOI ---
class BrowserAPI(FastAPI):
    def build_middleware_stack(self):
        # Include CORS on error responses too; keep FastAPI routes/lifespan intact.
        return CORSMiddleware(
            super().build_middleware_stack(), allow_origins=ORIGINS,
            allow_credentials=True, allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            allow_headers=['Content-Type', 'Authorization', 'X-Session-Mode'],
        )

# --- MA CU DUOC GIU LAI DE DOI CHIEU (khong thuc thi) ---
# ORIGINAL | app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=True, allow_methods=['GET','POST','DELETE'], allow_headers=['Content-Type','Authorization','X-Session-Mode'])
# --- HET MA CU; PHAN CAP NHAT DANG SU DUNG O DUOI ---
app = BrowserAPI(title='Kỳ Viện API', version='1.0.0')

@app.exception_handler(SQLAlchemyError)
async def database_unavailable(request: Request, error: SQLAlchemyError):
    logging.getLogger(__name__).error('Database request failed: %s', type(error).__name__)
    return JSONResponse(
        status_code=503,
        content={'detail': 'Kết nối dữ liệu tạm thời gián đoạn. Phiên đăng nhập được giữ nguyên; vui lòng thử lại.'},
        headers={'Retry-After': '3'},
    )

@app.middleware('http')

async def csrf_origin(request: Request, call_next):

    if request.method not in ('GET','HEAD','OPTIONS') and request.headers.get('origin') not in ORIGINS:

        return Response('Origin not allowed',status_code=403)

    return await call_next(request)

def db():

    with SessionLocal() as s: yield s

DB = Annotated[Session, Depends(db)]

def get_user(request: Request, s: DB):
# --- MA CU DUOC GIU LAI DE DOI CHIEU (khong thuc thi) ---
# ORIGINAL | 
# --- HET MA CU; PHAN CAP NHAT DANG SU DUNG O DUOI ---
    authorization = request.headers.get('authorization', '')
    token = authorization[7:] if authorization.startswith('Bearer ') else (
        '' if request.headers.get('x-session-mode') == 'tab' else request.cookies.get('session', '')
    )
    try:
# --- MA CU DUOC GIU LAI DE DOI CHIEU (khong thuc thi) ---
# ORIGINAL | 
# ORIGINAL |         authorization=request.headers.get('authorization','')
# ORIGINAL | 
# ORIGINAL |         token=authorization[7:] if authorization.startswith('Bearer ') else ('' if request.headers.get('x-session-mode')=='tab' else request.cookies.get('session',''))
# ORIGINAL | 
# --- HET MA CU; PHAN CAP NHAT DANG SU DUNG O DUOI ---
        payload = jwt.decode(token, SECRET, algorithms=['HS256'])
# --- MA CU DUOC GIU LAI DE DOI CHIEU (khong thuc thi) ---
# ORIGINAL | 
# ORIGINAL |         u = s.get(User, int(payload['sub']))
# ORIGINAL | 
# ORIGINAL |         if not u: raise ValueError()
# ORIGINAL | 
# ORIGINAL |         return u
# ORIGINAL | 
# ORIGINAL |     except Exception: raise HTTPException(401,'Vui lòng đăng nhập.')
# --- HET MA CU; PHAN CAP NHAT DANG SU DUNG O DUOI ---
        uid = int(payload['sub'])
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise HTTPException(401, 'Vui lòng đăng nhập.')
    # Database/network errors must reach the 503 handler, not invalidate tokens.
    user = s.get(User, uid)
    if not user:
        raise HTTPException(401, 'Vui lòng đăng nhập.')
    return user

Current = Annotated[User, Depends(get_user)]

def public_user(u): return {'id':u.id,'username':u.username}

def digest(password, salt=None):

    salt = salt or secrets.token_hex(16)

    return salt+':'+hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()

def session_cookie(response,u):

    token = jwt.encode({'sub':str(u.id),'exp':datetime.now(timezone.utc)+timedelta(days=7)},SECRET,algorithm='HS256')

    response.set_cookie('session',token,httponly=True,secure=COOKIE_SECURE,samesite=COOKIE_SAMESITE,max_age=604800,path='/')

def login_result(response,request,u):

    # Explicit per-tab clients do not create or use a shared browser cookie.

    if request.headers.get('x-session-mode')=='tab':

        token=jwt.encode({'sub':str(u.id),'exp':datetime.now(timezone.utc)+timedelta(days=7)},SECRET,algorithm='HS256')

        response.headers['Cache-Control']='no-store'

        return {**public_user(u),'access_token':token}

    session_cookie(response,u)

    return public_user(u)

limits = defaultdict(deque)

def limit(key, n=30, seconds=60):

    now = time.monotonic(); q = limits[key]

    while q and q[0] < now-seconds: q.popleft()

    if len(q) >= n: raise HTTPException(429,'Thao tác quá nhanh. Vui lòng thử lại sau.')

    q.append(now)

    if len(limits)>10000:

        for k in list(limits):

            if not limits[k] or limits[k][-1]<now-600: del limits[k]

def client_ip(request):

    # Behind the Next.js rewrite the socket peer is always the web container, so it cannot tell users apart.

    hops=[h.strip() for h in request.headers.get('x-forwarded-for','').split(',') if h.strip()]

    if PROXY_HOPS and len(hops)>=PROXY_HOPS:return hops[-PROXY_HOPS]

    return request.client.host if request.client else 'unknown'

class Credentials(BaseModel):

    username: str = Field(pattern=r'^[a-zA-Z0-9_]{3,24}$')

    password: str = Field(min_length=8,max_length=128)

@app.get('/api/health')

def health(s: DB):

    s.execute(select(1)); return {'status':'ok'}

@app.post('/api/auth/register')

def register(data:Credentials,response:Response,request:Request,s:DB):

    limit(('register',client_ip(request)),20,60)

    name=data.username.lower()

    if s.scalar(select(User).where(User.username==name)): raise HTTPException(409,'Tên kỳ thủ đã được sử dụng.')

    u=User(username=name,password=digest(data.password));s.add(u)

    try:s.commit()

    except Exception:s.rollback();raise HTTPException(409,'Tên kỳ thủ đã được sử dụng.')

    return login_result(response,request,u)

@app.post('/api/auth/login')

def login(data:Credentials,response:Response,request:Request,s:DB):

    # Per-account throttle stops password guessing without letting one client lock everybody out.

    limit(('login-ip',client_ip(request)),100,60);limit(('login',data.username.lower()),10,60)

    u=s.scalar(select(User).where(User.username==data.username.lower()))

    # Always run the password KDF, including for unknown users.

    expected=u.password if u else '0'*32+':'+'0'*128

    candidate=digest(data.password,expected.split(':')[0])

    if not u or not hmac.compare_digest(candidate,expected):raise HTTPException(401,'Tên đăng nhập hoặc mật khẩu không đúng.')

    return login_result(response,request,u)

@app.get('/api/auth/me')

def me(u:Current):return public_user(u)

@app.post('/api/auth/logout')

async def logout(response:Response,u:Current):

    response.delete_cookie('session',path='/',secure=COOKIE_SECURE,samesite=COOKIE_SAMESITE)

    for code, peers in list(connections.items()):

        for ws, uid in list(peers.items()):

            if uid==u.id: await ws.close(code=1000)

    return {'ok':True}

class RoomInput(BaseModel): name:str=Field(default='Giao hữu',min_length=1,max_length=60); total_seconds:int=Field(default=900,ge=300,le=3600); move_seconds:int=Field(default=60,ge=10,le=60); stake:int=Field(default=100,ge=100,le=1000)

def room_data(r,s):

    return {'code':r.code,'name':r.name,'red_id':r.red_id,'black_id':r.black_id,'red_name':s.get(User,r.red_id).username,'black_name':s.get(User,r.black_id).username if r.black_id else None,'board':r.board,'turn':r.turn,'history':r.history,'status':r.status,'winner':r.winner,'version':r.version,'total_seconds':r.total_seconds,'move_seconds':r.move_seconds,'stake':r.stake,**quick_data(r,s),**coin_data(r,s)}

def member(r,u):

    if not r: raise HTTPException(404,'Không tìm thấy phòng.')

    if u.id not in (r.red_id,r.black_id):raise HTTPException(403,'Bạn không thuộc phòng này.')

def position_key(b,t):return json.dumps([b,t],separators=(',',':'))

connections: dict[str,dict[WebSocket,int]]=defaultdict(dict)

def online(code):return sorted(set(connections.get(code,{}).values()))

async def broadcast(code,data,exclude=None):

    for ws in list(connections.get(code,{})):

        if ws is exclude:continue

        try:await ws.send_json(data)

        except Exception:connections[code].pop(ws,None)

@app.post('/api/rooms')

def create_room(data:RoomInput,u:Current,s:DB):

    limit(('create',u.id),10,60)

    if data.stake not in (100,250,500,1000):raise HTTPException(400,'Mức xu không hợp lệ.')

    if wallet(s,u.id).coins<data.stake:raise HTTPException(409,'Bạn không đủ xu để tạo bàn này.')

    if active_quick(s,u.id):raise HTTPException(409,'Hãy kết thúc trận hiện tại trước.')

    for _ in range(20):

        code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))

        if not s.get(Room,code):break

    b=initial();r=Room(code=code,name=data.name.strip() or 'Giao hữu',red_id=u.id,board=b,history=[],positions=[position_key(b,'r')],total_seconds=data.total_seconds,move_seconds=data.move_seconds,stake=data.stake);s.add(r);s.commit();return room_data(r,s)

@app.get('/api/rooms')

def rooms(s:DB):

    # Only rooms whose owner is connected right now; abandoned waiting rooms would otherwise pile up forever.

    rows=s.scalars(select(Room).where(Room.status=='waiting').order_by(Room.created_at.desc().nulls_last()).limit(200))

    return [room_data(r,s) for r in rows if connections.get(r.code)][:50]

@app.get('/api/rooms/mine')

def my_rooms(u:Current,s:DB):

    rows=s.scalars(select(Room).where(or_(Room.red_id==u.id,Room.black_id==u.id),Room.status.in_(('waiting','ready','playing'))).order_by(Room.created_at.desc().nulls_last()).limit(10))

    return [room_data(r,s) for r in rows]

@app.post('/api/rooms/{code}/join')

async def join(code:str,u:Current,s:DB):

    limit(('join',u.id),30,60)

    r=s.scalar(select(Room).where(Room.code==code.upper()).with_for_update())

    if not r:raise HTTPException(404,'Không tìm thấy mã phòng này.')

    if u.id not in (r.red_id,r.black_id):

        if active_quick(s,u.id) or active_quick(s,r.red_id):raise HTTPException(409,'Một kỳ thủ đang có trận ngẫu nhiên. Hãy kết thúc trận đó trước.')

        if r.black_id or r.status!='waiting':raise HTTPException(409,'Phòng đã đủ người hoặc đã kết thúc.')

        r.black_id=u.id;r.status='playing';r.version+=1

        reserve_coins(s,r,r.stake)

        s.add(MatchClock(code=r.code,total_seconds=r.total_seconds,move_seconds=r.move_seconds,

            red_remaining=r.total_seconds,black_remaining=r.total_seconds,turn_started=time.time()))

        s.add(QuickMatch(code=r.code,red_ready=1,black_ready=1,deadline=0))

        for pid in (r.red_id,r.black_id):

            queued=s.get(QuickQueue,pid)

            if queued:s.delete(queued)

        s.flush();start_coins(s,r)

    s.commit();data=room_data(r,s);await broadcast(r.code,{'type':'state','room':data});return data

@app.get('/api/rooms/{code}/preview')

def preview_room(code:str,u:Current,s:DB):

    r=s.get(Room,code.upper())

    if not r:raise HTTPException(404,'Không tìm thấy phòng.')

    return {'code':r.code,'name':r.name,'stake':r.stake,'total_seconds':r.total_seconds,'move_seconds':r.move_seconds,'status':r.status,'host':s.get(User,r.red_id).username}

class InviteInput(BaseModel):username:str=Field(min_length=3,max_length=24)

@app.post('/api/rooms/{code}/invite')

def invite(code:str,data:InviteInput,u:Current,s:DB):

    limit(('invite',u.id),15,60)

    r=s.get(Room,code);member(r,u)

    if r.status!='waiting':raise HTTPException(409,'Phòng không còn chỗ trống.')

    target=s.scalar(select(User).where(User.username==data.username.lower()))

    if not target:raise HTTPException(404,'Không tìm thấy kỳ thủ.')

    if target.id==u.id:raise HTTPException(400,'Hãy mời một kỳ thủ khác.')

    if not s.scalar(select(Invitation).where(Invitation.room_code==code,Invitation.receiver_id==target.id)):

        s.add(Invitation(room_code=code,sender_id=u.id,receiver_id=target.id));s.commit()

    return {'ok':True}

@app.get('/api/invitations')

def invitations(u:Current,s:DB):

    rows=s.scalars(select(Invitation).join(Room,Room.code==Invitation.room_code).where(Invitation.receiver_id==u.id,Room.status=='waiting').limit(50))

    return [{'id':i.id,'code':i.room_code,'sender':s.get(User,i.sender_id).username ,'stake':s.get(Room,i.room_code).stake,'total_seconds':s.get(Room,i.room_code).total_seconds,'move_seconds':s.get(Room,i.room_code).move_seconds} for i in rows]

@app.delete('/api/invitations/{invitation_id}')

def dismiss_invitation(invitation_id:int,u:Current,s:DB):

    row=s.get(Invitation,invitation_id)

    if not row or row.receiver_id!=u.id:raise HTTPException(404,'Không tìm thấy lời mời.')

    s.delete(row);s.commit();return {'ok':True}

class MoveInput(BaseModel):

    from_:int=Field(alias='from',ge=0,le=89)

    to:int=Field(ge=0,le=89)

    piece:str=Field(pattern='^[rb][KAEHRCP]$')

    captured:str|None=Field(default=None,pattern='^[rb][KAEHRCP]$')

class SaveInput(BaseModel):

    name:str=Field(min_length=1,max_length=80)

    board:list[str|None]=Field(min_length=90,max_length=90)

    turn:str=Field(pattern='^[rb]$')

    history:list[MoveInput]=Field(max_length=5000)

    mode:str=Field(default='local',pattern='^(ai|local|online)$')

@app.post('/api/saves')

def save(data:SaveInput,u:Current,s:DB):

    limit(('save',u.id),20,60)

    if not valid_position(data.board,data.turn):raise HTTPException(400,'Bàn cờ không hợp lệ.')

    d=data.model_dump(by_alias=True);d['date']=datetime.now(timezone.utc).isoformat()

    row=Saved(user_id=u.id,data=d);s.add(row);s.commit();return {**d,'id':str(row.id)}

@app.get('/api/saves')

def saves(u:Current,s:DB):return [{**r.data,'id':str(r.id)} for r in s.scalars(select(Saved).where(Saved.user_id==u.id).order_by(Saved.id.desc()).limit(100))]

@app.delete('/api/saves/{sid}')

def delete_save(sid:int,u:Current,s:DB):

    row=s.get(Saved,sid)

    if not row or row.user_id!=u.id:raise HTTPException(404,'Không tìm thấy ván đã lưu.')

    s.delete(row);s.commit();return {'ok':True}

@app.get('/api/rtc-config')

def rtc_config(u:Current):

    servers=[{'urls':'stun:stun.l.google.com:19302'}]

    if os.getenv('TURN_URL'):servers.append({'urls':os.environ['TURN_URL'],'username':os.environ.get('TURN_USERNAME',''),'credential':os.environ.get('TURN_PASSWORD','')})

    return {'iceServers':servers}

tickets={}

@app.post('/api/ws-ticket')

def ticket(u:Current):

    limit(('ticket',u.id),30,60)

    for key,(_,expiry) in list(tickets.items()):

        if expiry<time.time():tickets.pop(key,None)

    key=secrets.token_urlsafe(32);tickets[key]=(u.id,time.time()+30);return {'ticket':key}

@app.websocket('/api/ws/{code}')

async def websocket(ws:WebSocket,code:str):

    if ws.headers.get('origin') not in ORIGINS:await ws.close(code=1008);return

    credential=tickets.pop(ws.query_params.get('ticket',''),None)

    if not credential or credential[1]<time.time():await ws.close(code=1008);return

    uid=credential[0]

    with SessionLocal() as s:

        r=s.get(Room,code)

        if not r or uid not in (r.red_id,r.black_id):await ws.close(code=1008);return

        snapshot=room_data(r,s)
        snapshot=personalize_coup(snapshot,s,uid) # KYVIEN_COUP_SNAPSHOT

        recent=list(s.scalars(select(Message).where(Message.room_code==code).order_by(Message.id.desc()).limit(100)))

        messages=[{'username':s.get(User,m.user_id).username,'text':m.text,'time':m.time} for m in reversed(recent)]

    # One socket per player/room prevents duplicated game commands and calls.

    # Close code 4001 tells the replaced tab not to reconnect (two tabs would otherwise kick each other forever).

    for old, user_id in list(connections.get(code,{}).items()):

        if user_id==uid:

            connections[code].pop(old,None)

            try:await old.close(code=4001)

            except Exception:pass

    await ws.accept();connections[code][ws]=uid

    await ws.send_json({'type':'state','room':snapshot});await ws.send_json({'type':'messages','messages':messages})

    await broadcast(code,{'type':'presence','online':online(code)})

    try:

        while True:

            raw=await ws.receive_text()

            if len(raw)>20000:await ws.close(code=1009);break

            try:

                try:d=json.loads(raw)

                except ValueError:d=None

                # Application-level heartbeat: keeps idle sockets alive through proxies with short read timeouts.

                if isinstance(d,dict) and d.get('type')=='ping':limit(('ping',uid),30,60);await ws.send_json({'type':'pong'});continue

                limit(('ws',uid),120,60)

                if not isinstance(d,dict):raise ValueError('Dữ liệu không hợp lệ.')

                kind=d.get('type')

                if kind=='signal':

                    with SessionLocal() as guard:

                        active=guard.get(Room,code)

                        if not active or active.status not in ('ready','playing'): raise ValueError('Cuộc gọi chỉ khả dụng trong trận đang hoạt động.')

                    payload=d.get('data')

                    if not isinstance(payload,dict) or payload.get('kind') not in ('offer','answer','ice','hangup','busy'):raise ValueError('Tín hiệu không hợp lệ.')

                    await broadcast(code,{'type':'signal','data':payload},exclude=ws);continue

                with SessionLocal() as s:

                    r=s.scalar(select(Room).where(Room.code==code).with_for_update())

                    if not r: raise ValueError('Phòng không tồn tại.')

                    clock_now=time.time()

                    if expire_clock(s,r,clock_now):

                        s.commit()

                        await broadcast(code,{'type':'state','room':room_data(r,s)})

                        continue

                    if await quick_command(s,r,uid,d): continue

                    if r.status=='cancelled': raise ValueError('Trận đã hủy.')

                    if kind=='chat':

                        text=d.get('text','')

                        if not isinstance(text,str) or not 1<=len(text.strip())<=1000:raise ValueError('Tin nhắn phải dài 1–1000 ký tự.')

                        limit(('chat',uid),20,60)

                        stamp=datetime.now(timezone.utc).isoformat();text=text.strip()

                        s.add(Message(room_code=code,user_id=uid,text=text,time=stamp));s.commit()

                        await broadcast(code,{'type':'chat','message':{'username':s.get(User,uid).username,'text':text,'time':stamp}});continue

                    if r.status!='playing':raise ValueError('Ván cờ chưa bắt đầu hoặc đã kết thúc.')

                    side='r' if uid==r.red_id else 'b'

                    if kind=='resign':r.status='finished';r.winner=other(side);r.version+=1

                    elif kind=='move':

                        f,t=d.get('from'),d.get('to')

                        if side!=r.turn:raise ValueError('Chưa đến lượt của bạn.')

                        if d.get('version')!=r.version:raise ValueError('Bàn cờ đã thay đổi. Hãy chờ đồng bộ.')

                        if type(f)!=int or type(t)!=int or not (0<=f<90 and 0<=t<90):raise ValueError('Ô cờ không hợp lệ.')

                        if not r.board[f] or r.board[f][0]!=side or not legal(r.board,f,t):raise ValueError('Nước đi không hợp lệ.')

                        m={'from':f,'to':t,'piece':r.board[f],'captured':r.board[t]}

                        quick=s.get(QuickMatch,r.code)

                        if quick: quick.draw_by=None

                        if coin_data(r,s):move_coins(s,uid,m['captured'])

                        spend_clock(s,r,clock_now,advance=True)

                        r.board=moved(r.board,f,t);r.history=r.history+[m];r.turn=other(side);r.version+=1

                        key=position_key(r.board,r.turn);r.positions=r.positions+[key]

                        if not has_moves(r.board,r.turn):r.status='finished';r.winner=side

                        elif r.positions.count(key)>=3:r.status='draw'

                    else:raise ValueError('Thao tác không được hỗ trợ.')

                    if r.status in ('finished','draw'):spend_clock(s,r,clock_now,stop=True)

                    settle_coins(s,r)

                    s.commit();state=room_data(r,s)

                await broadcast(code,{'type':'state','room':state})

            except (ValueError,HTTPException) as e:

                await ws.send_json({'type':'error','message':e.detail if isinstance(e,HTTPException) else str(e)})

    except WebSocketDisconnect:pass

    finally:

        connections.get(code,{}).pop(ws,None)

        # No hangup relay here: a dropped socket is not a dropped call. Clients watch presence instead.

        if connections.get(code):await broadcast(code,{'type':'presence','online':online(code)})

        else:connections.pop(code,None)

# RANDOM MATCHMAKING — run with --workers 1, as for the existing WebSocket service.

READY_SECONDS = 30

QUEUE_TTL = 15

# Defaults apply to new games. No increment: unused thinking time stays in the bank.

MATCH_TOTAL_SECONDS = int(os.getenv('MATCH_TOTAL_SECONDS','900'))

MATCH_MOVE_SECONDS = int(os.getenv('MATCH_MOVE_SECONDS','60'))

if MATCH_TOTAL_SECONDS not in (900,1200):raise RuntimeError('MATCH_TOTAL_SECONDS must be 900 or 1200')

if not 10 <= MATCH_MOVE_SECONDS <= MATCH_TOTAL_SECONDS:raise RuntimeError('Invalid MATCH_MOVE_SECONDS')

def clock_data(r,s):

    c=s.get(MatchClock,r.code)

    if not c:return {}

    return {'clock':{'total_seconds':c.total_seconds,'move_seconds':c.move_seconds,

        'red_remaining':c.red_remaining,'black_remaining':c.black_remaining,

        'turn_started':c.turn_started,'finish_reason':c.finish_reason}}

def spend_clock(s,r,now,advance=False,stop=False):

    c=s.get(MatchClock,r.code)

    if not c or c.turn_started is None:return

    field='red_remaining' if r.turn=='r' else 'black_remaining'

    elapsed=min(max(0,now-c.turn_started),c.move_seconds,getattr(c,field))

    setattr(c,field,max(0,getattr(c,field)-elapsed))

    c.turn_started=None if stop else (now if advance else c.turn_started)

def expire_clock(s,r,now):

    c=s.get(MatchClock,r.code)

    if r.status!='playing' or not c or c.turn_started is None:return False

    remaining=c.red_remaining if r.turn=='r' else c.black_remaining

    if now < c.turn_started+min(remaining,c.move_seconds):return False

    c.finish_reason='total_timeout' if remaining<=c.move_seconds else 'move_timeout'

    spend_clock(s,r,now,stop=True)

    r.status='finished';r.winner=other(r.turn);r.version+=1

    q=s.get(QuickMatch,r.code)

    if q:q.draw_by=None

    settle_coins(s,r)

    return True

EMOTIONS = ('👍','👏','😄','😮','🤔','😅','😢','🤝','🔥','❤️')

match_lock = asyncio.Lock()

match_sweeper = None

def quick_data(r, s):

    q=s.get(QuickMatch,r.code)

    return {'quick': bool(q), 'red_ready': bool(q.red_ready) if q else False,

            'black_ready': bool(q.black_ready) if q else False,

            'ready_deadline': q.deadline if q else None, 'server_time': time.time(),

            'draw_by': q.draw_by if q else None, 'cancel_reason': q.cancel_reason if q else None, **clock_data(r,s)}

def expire_quick(s):

    now=time.time(); changed=[]

    for queue in s.scalars(select(QuickQueue).where(QuickQueue.heartbeat < now-QUEUE_TTL)):

        s.delete(queue)

    for q in s.scalars(select(QuickMatch).join(Room).where(Room.status=='ready',QuickMatch.deadline<=now)):

        r=s.get(Room,q.code);r.status='cancelled';r.version+=1

        q.cancel_reason='Hết 30 giây: chưa đủ hai người sẵn sàng.'

        settle_coins(s,r)

        changed.append(r.code)

    for r in s.scalars(select(Room).join(MatchClock).where(Room.status=='playing').with_for_update()):

        if expire_clock(s,r,now):changed.append(r.code)

    s.commit()

    return changed

async def publish_rooms(codes):

    for code in codes:

        with SessionLocal() as s:

            r=s.get(Room,code)

            if r: await broadcast(code,{'type':'state','room':room_data(r,s)})

async def sweep_matches():

    while True:

        await asyncio.sleep(.5)

        try:

            async with match_lock:

# --- MA CU DUOC GIU LAI DE DOI CHIEU (khong thuc thi) ---
# ORIGINAL |                 with SessionLocal() as s: changed=expire_quick(s)
# --- HET MA CU; PHAN CAP NHAT DANG SU DUNG O DUOI ---
                # Synchronous PostgreSQL I/O must not block WebSocket heartbeats.
                def sweep_database():
                    with SessionLocal() as s:
                        return expire_quick(s)
                changed = await asyncio.to_thread(sweep_database)

            await publish_rooms(changed)

        except asyncio.CancelledError: raise

        except Exception:

            import logging

            logging.getLogger(__name__).exception('Match deadline sweep failed')

@app.on_event('startup')

async def start_match_sweeper():

    global match_sweeper

    # A server restart must not match users from stale queue entries.

    with SessionLocal() as s:

        for q in s.scalars(select(QuickQueue)):s.delete(q)

        s.commit()

    match_sweeper=asyncio.create_task(sweep_matches())

@app.on_event('shutdown')

async def stop_match_sweeper():

    if match_sweeper:

        match_sweeper.cancel()

        try: await match_sweeper

        except asyncio.CancelledError: pass

def active_quick(s, uid):

    return s.scalar(select(Room).join(QuickMatch).where(

        or_(Room.red_id==uid,Room.black_id==uid),Room.status.in_(('ready','playing'))

    ).order_by(Room.created_at.desc()))

@app.post('/api/matchmaking/join')

async def join_matchmaking(u:Current,s:DB):

    limit(('match-join',u.id),20,60)

    async with match_lock:

        changed=expire_quick(s)

        active=active_quick(s,u.id)

        if active: result={'status':'matched','room':room_data(active,s)}

        else:

            other_room=s.scalar(select(Room).where(or_(Room.red_id==u.id,Room.black_id==u.id),Room.status=='playing'))

            if other_room:raise HTTPException(409,'Bạn còn một ván chưa kết thúc. Hãy quay lại kỳ đài để kết thúc ván đó.')

            if wallet(s,u.id).coins<MIN_STAKE:raise HTTPException(409,'Bạn cần ít nhất 100 xu. Vào Nhiệm vụ hôm nay để nhận xu miễn phí.')

            entry=s.get(QuickQueue,u.id)

            if entry:entry.heartbeat=time.time()

            else:s.add(QuickQueue(user_id=u.id,heartbeat=time.time()))

            s.flush()

            candidates=[q.user_id for q in s.scalars(select(QuickQueue).where(QuickQueue.user_id!=u.id))

                        if wallet(s,q.user_id).coins>=MIN_STAKE and not s.scalar(select(Room).where(or_(Room.red_id==q.user_id,Room.black_id==q.user_id),Room.status.in_(('ready','playing'))))]

            if not candidates:

                s.commit();result={'status':'searching'}

            else:

                opponent=secrets.choice(candidates)

                red,black=(u.id,opponent) if secrets.randbelow(2) else (opponent,u.id)

                code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))

                while s.get(Room,code):code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))

                b=initial();r=Room(code=code,name='Ngẫu nhiên · Kỳ Vân Các',red_id=red,black_id=black,

                    board=b,history=[],positions=[position_key(b,'r')],status='ready')

                s.add(r);s.flush();s.add(QuickMatch(code=code,deadline=time.time()+READY_SECONDS))

                s.add(MatchClock(code=code,total_seconds=MATCH_TOTAL_SECONDS,move_seconds=MATCH_MOVE_SECONDS,

                    red_remaining=MATCH_TOTAL_SECONDS,black_remaining=MATCH_TOTAL_SECONDS))

                reserve_coins(s,r)

                for uid in (u.id,opponent):

                    q=s.get(QuickQueue,uid)

                    if q:s.delete(q)

                s.commit();result={'status':'matched','room':room_data(r,s)}

    await publish_rooms(changed)

    return result

@app.get('/api/matchmaking/status')

async def matchmaking_status(u:Current,s:DB):

    async with match_lock:

        changed=expire_quick(s)

        r=active_quick(s,u.id)

        if r:result={'status':'matched','room':room_data(r,s)}

        else:

            q=s.get(QuickQueue,u.id)

            if q:q.heartbeat=time.time();s.commit()

            result={'status':'searching' if q else 'idle'}

    await publish_rooms(changed)

    return result

@app.delete('/api/matchmaking/queue')

async def cancel_matchmaking(u:Current,s:DB):

    async with match_lock:

        q=s.get(QuickQueue,u.id)

        if q:s.delete(q)

        r=active_quick(s,u.id)

        if r and r.status=='ready':

            r.status='cancelled';r.version+=1

            s.get(QuickMatch,r.code).cancel_reason='Một kỳ thủ đã hủy trước khi bắt đầu.'

        elif r and r.status=='playing':raise HTTPException(409,'Ván đã bắt đầu. Hãy dùng Xin thua hoặc Ra ngoài trong bàn cờ.')

        if r:settle_coins(s,r)

        s.commit();code=r.code if r else None

    if code:await publish_rooms([code])

    return {'ok':True}

@app.get('/api/rooms/{code}')

async def read_room(code:str,u:Current,s:DB):

    r=s.scalar(select(Room).where(Room.code==code.upper()).with_for_update());member(r,u)

    expired=expire_clock(s,r,time.time())

    if expired:s.commit()

    data=room_data(r,s)

    if expired:await broadcast(r.code,{'type':'state','room':data})

    return data

async def quick_command(s,r,uid,d):

    kind=d.get('type');q=s.get(QuickMatch,r.code)

    if kind=='reaction':

        if r.status not in ('ready','playing'):raise ValueError('Trận không hoạt động.')

        emoji=d.get('emoji')

        if emoji not in EMOTIONS:raise ValueError('Cảm xúc không hợp lệ.')

        limit(('reaction',uid),6,10)

        await broadcast(r.code,{'type':'reaction','user_id':uid,'emoji':emoji});return True

    if kind not in ('ready','cancel_ready','leave','draw_offer','draw_accept','draw_decline'):return False

    if not q and kind=='leave' and r.status=='waiting':

        r.status='cancelled';r.version+=1;s.commit()

        await broadcast(r.code,{'type':'state','room':room_data(r,s)});return True

    if not q:raise ValueError('Thao tác này chỉ áp dụng cho ghép trận ngẫu nhiên.')

    if r.status=='ready' and time.time()>=q.deadline:

        r.status='cancelled';r.version+=1;q.cancel_reason='Hết 30 giây: chưa đủ hai người sẵn sàng.'

    elif kind=='ready':

        if r.status=='playing':return True # Duplicate ready command.

        if r.status!='ready':raise ValueError('Đã hết thời gian sẵn sàng.')

        if uid==r.red_id:q.red_ready=1

        else:q.black_ready=1

        if q.red_ready and q.black_ready:

            r.status='playing'

            c=s.get(MatchClock,r.code)

            if not c:

                c=MatchClock(code=r.code,total_seconds=MATCH_TOTAL_SECONDS,move_seconds=MATCH_MOVE_SECONDS,

                    red_remaining=MATCH_TOTAL_SECONDS,black_remaining=MATCH_TOTAL_SECONDS)

                s.add(c)

            c.turn_started=time.time()

            start_coins(s,r)

        r.version+=1

    elif kind in ('cancel_ready','leave'):

        if r.status=='ready':

            r.status='cancelled';q.cancel_reason='Một kỳ thủ đã rời trước khi bắt đầu.'

        elif r.status=='playing' and kind=='leave':

            r.status='finished';r.winner='b' if uid==r.red_id else 'r'

        else:raise ValueError('Không thể rời theo thao tác này.')

        r.version+=1;q.draw_by=None

    else:

        if r.status!='playing':raise ValueError('Ván chưa bắt đầu hoặc đã kết thúc.')

        if kind=='draw_offer':

            if q.draw_by:raise ValueError('Đang có một lời đề nghị hòa.')

            limit(('draw-offer',uid),3,60);q.draw_by=uid

        elif kind=='draw_accept':

            if not q.draw_by or q.draw_by==uid:raise ValueError('Không có đề nghị hòa từ đối thủ.')

            r.status='draw';q.draw_by=None

        elif kind=='draw_decline':

            if not q.draw_by or q.draw_by==uid:raise ValueError('Không có đề nghị hòa từ đối thủ.')

            q.draw_by=None

        r.version+=1

    if r.status in ('finished','draw'):spend_clock(s,r,time.time(),stop=True)

    settle_coins(s,r)

    s.commit();await broadcast(r.code,{'type':'state','room':room_data(r,s)});return True

# Friend graph, requests, and lobby presence are additive to the original account API.

def _online_ids(s, now=None):

    stamp=time.time() if now is None else now

    ids=set(s.scalars(select(UserPresence.user_id).where(UserPresence.seen_at>=stamp-45)))

    for peers in connections.values():ids.update(peers.values())

    return ids

@app.post('/api/presence/heartbeat')

def presence_heartbeat(u:Current,s:DB):

    row=s.get(UserPresence,u.id)

    if row:row.seen_at=time.time()

    else:s.add(UserPresence(user_id=u.id,seen_at=time.time()))

    s.commit();return {'ok':True}

@app.get('/api/friends')

def list_friends(u:Current,s:DB):

    links=s.scalars(select(Friendship).where(or_(Friendship.user_low==u.id,Friendship.user_high==u.id))).all()

    ids=[x.user_high if x.user_low==u.id else x.user_low for x in links]

    online_ids=_online_ids(s)

    users=s.scalars(select(User).where(User.id.in_(ids))).all() if ids else []

    return [{'id':x.id,'username':x.username,'online':x.id in online_ids} for x in users]

@app.get('/api/friends/search')

def search_friends(q:str,u:Current,s:DB):

    name=q.strip().lower()

    if len(name)<3:raise HTTPException(400,'Nhập ít nhất 3 ký tự tên đăng nhập.')

    rows=s.scalars(select(User).where(User.username.contains(name),User.id!=u.id).order_by(User.username).limit(20)).all()

    linked={x.user_high if x.user_low==u.id else x.user_low for x in s.scalars(select(Friendship).where(or_(Friendship.user_low==u.id,Friendship.user_high==u.id)))}

    outgoing={x.receiver_id for x in s.scalars(select(FriendRequest).where(FriendRequest.sender_id==u.id))}

    incoming={x.sender_id for x in s.scalars(select(FriendRequest).where(FriendRequest.receiver_id==u.id))}

    online_ids=_online_ids(s)

    return [{'id':x.id,'username':x.username,'online':x.id in online_ids,'status':'friend' if x.id in linked else 'sent' if x.id in outgoing else 'received' if x.id in incoming else 'none'} for x in rows]

@app.get('/api/friends/requests')

def friend_requests(u:Current,s:DB):

    incoming=s.scalars(select(FriendRequest).where(FriendRequest.receiver_id==u.id).order_by(FriendRequest.created_at.desc()).limit(50)).all()

    outgoing=s.scalars(select(FriendRequest).where(FriendRequest.sender_id==u.id).order_by(FriendRequest.created_at.desc()).limit(50)).all()

    def pack(row,incoming):

        who=s.get(User,row.sender_id if incoming else row.receiver_id)

        return {'id':row.id,'user_id':who.id,'username':who.username,'created_at':row.created_at}

    return {'incoming':[pack(x,True) for x in incoming],'outgoing':[pack(x,False) for x in outgoing]}

class FriendRequestInput(BaseModel): username:str=Field(min_length=3,max_length=24)

@app.post('/api/friends/requests')

async def send_friend_request(data:FriendRequestInput,u:Current,s:DB):

    limit(('friend-request',u.id),20,60)

    target=s.scalar(select(User).where(User.username==data.username.lower()))

    if not target:raise HTTPException(404,'Không tìm thấy tài khoản này.')

    if target.id==u.id:raise HTTPException(400,'Bạn không thể tự kết bạn với mình.')

    low,high=sorted((u.id,target.id))

    if s.scalar(select(Friendship).where(Friendship.user_low==low,Friendship.user_high==high)):

        return {'ok':True,'status':'friend'}

    inverse=s.scalar(select(FriendRequest).where(FriendRequest.sender_id==target.id,FriendRequest.receiver_id==u.id))

    if inverse:

        s.add(Friendship(user_low=low,user_high=high));s.delete(inverse);s.commit()

        status='friend'

    else:

        req=s.scalar(select(FriendRequest).where(FriendRequest.sender_id==u.id,FriendRequest.receiver_id==target.id))

        if not req:s.add(FriendRequest(sender_id=u.id,receiver_id=target.id));s.commit()

        status='sent'

    pending=s.scalar(select(FriendRequest).where(FriendRequest.sender_id==u.id,FriendRequest.receiver_id==target.id))

    for peers in list(connections.values()):

        for ws,uid in list(peers.items()):

            if uid==target.id:

                try:await ws.send_json({'type':'friend_request','username':u.username,'request_id':pending.id if pending else None,'status':status})

                except Exception:pass

    return {'ok':True,'status':status}

class FriendDecision(BaseModel): request_id:int=Field(gt=0)

@app.post('/api/friends/requests/accept')

def accept_friend_request(data:FriendDecision,u:Current,s:DB):

    row=s.scalar(select(FriendRequest).where(FriendRequest.id==data.request_id,FriendRequest.receiver_id==u.id).with_for_update())

    if not row:raise HTTPException(404,'Yêu cầu kết bạn không còn tồn tại.')

    low,high=sorted((u.id,row.sender_id))

    if not s.scalar(select(Friendship).where(Friendship.user_low==low,Friendship.user_high==high)):

        s.add(Friendship(user_low=low,user_high=high))

    s.delete(row);s.commit();return {'ok':True}

@app.post('/api/friends/requests/reject')

def reject_friend_request(data:FriendDecision,u:Current,s:DB):

    row=s.scalar(select(FriendRequest).where(FriendRequest.id==data.request_id,FriendRequest.receiver_id==u.id))

    if not row:raise HTTPException(404,'Yêu cầu kết bạn không còn tồn tại.')

    s.delete(row);s.commit();return {'ok':True}

@app.delete('/api/friends/{friend_id}')

def remove_friend(friend_id:int,u:Current,s:DB):

    low,high=sorted((u.id,friend_id))

    row=s.scalar(select(Friendship).where(Friendship.user_low==low,Friendship.user_high==high))

    if not row:raise HTTPException(404,'Không tìm thấy bạn bè này.')

    s.delete(row);s.commit();return {'ok':True}

# Loaded after the original models/routes to keep existing API structure.

from .economy import wallet, MIN_STAKE, reserve_coins, settle_coins, coin_data, start_coins, move_coins

# KYVIEN_RANK_V1: giữ nguyên mã cũ, bổ sung cấp bậc và avatar.

from .rankings import install_rankings

install_rankings(globals())

# KYVIEN_COUP_V1: bổ sung, không xóa mã cờ tướng cũ.
from .coup import install_coup, personalize as personalize_coup
install_coup(globals())

# KYVIEN_SPECTATE_V1: thêm API chỉ đọc cho khán giả.
from . import spectating


# KYVIEN_JOURNEY_V1
from .journey import install_journey
install_journey(globals())
