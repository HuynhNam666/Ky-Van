"""Kỳ Viện FastAPI service. Run one worker; PostgreSQL is authoritative."""
import asyncio, hashlib, hmac, json, os, re, secrets, time
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import Annotated
import jwt
from fastapi import FastAPI, Depends, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, String, Integer, Text, JSON, ForeignKey, DateTime, select, or_, inspect, text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker, Session
from .chess import initial, other, legal, moved, has_moves, valid_position

DATABASE_URL = os.environ['DATABASE_URL']
SECRET = os.environ['JWT_SECRET']
if len(SECRET) < 32: raise RuntimeError('JWT_SECRET must contain at least 32 characters')
ORIGINS = [s.strip() for s in os.getenv('ALLOWED_ORIGINS','http://localhost:3000').split(',')]
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
Base.metadata.create_all(engine)
def migrate(eng=engine):
    # create_all never alters existing tables: add the columns introduced after the first release.
    with eng.begin() as c:
        if 'created_at' not in {x['name'] for x in inspect(c).get_columns('rooms')}:
            c.execute(text('ALTER TABLE rooms ADD COLUMN created_at '+DateTime(timezone=True).compile(dialect=eng.dialect)))
migrate()
app = FastAPI(title='Kỳ Viện API', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=True, allow_methods=['GET','POST','DELETE'], allow_headers=['Content-Type'])
@app.middleware('http')
async def csrf_origin(request: Request, call_next):
    if request.method not in ('GET','HEAD','OPTIONS') and request.headers.get('origin') not in ORIGINS:
        return Response('Origin not allowed',status_code=403)
    return await call_next(request)
def db():
    with SessionLocal() as s: yield s
DB = Annotated[Session, Depends(db)]
def get_user(request: Request, s: DB):
    try:
        payload = jwt.decode(request.cookies.get('session',''), SECRET, algorithms=['HS256'])
        u = s.get(User, int(payload['sub']))
        if not u: raise ValueError()
        return u
    except Exception: raise HTTPException(401,'Vui lòng đăng nhập.')
Current = Annotated[User, Depends(get_user)]
def public_user(u): return {'id':u.id,'username':u.username}
def digest(password, salt=None):
    salt = salt or secrets.token_hex(16)
    return salt+':'+hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
def session_cookie(response,u):
    token = jwt.encode({'sub':str(u.id),'exp':datetime.now(timezone.utc)+timedelta(days=7)},SECRET,algorithm='HS256')
    response.set_cookie('session',token,httponly=True,secure=COOKIE_SECURE,samesite=COOKIE_SAMESITE,max_age=604800,path='/')
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
    session_cookie(response,u);return public_user(u)
@app.post('/api/auth/login')
def login(data:Credentials,response:Response,request:Request,s:DB):
    # Per-account throttle stops password guessing without letting one client lock everybody out.
    limit(('login-ip',client_ip(request)),100,60);limit(('login',data.username.lower()),10,60)
    u=s.scalar(select(User).where(User.username==data.username.lower()))
    # Always run the password KDF, including for unknown users.
    expected=u.password if u else '0'*32+':'+'0'*128
    candidate=digest(data.password,expected.split(':')[0])
    if not u or not hmac.compare_digest(candidate,expected):raise HTTPException(401,'Tên đăng nhập hoặc mật khẩu không đúng.')
    session_cookie(response,u);return public_user(u)
@app.get('/api/auth/me')
def me(u:Current):return public_user(u)
@app.post('/api/auth/logout')
async def logout(response:Response,u:Current):
    response.delete_cookie('session',path='/',secure=COOKIE_SECURE,samesite=COOKIE_SAMESITE)
    for code, peers in list(connections.items()):
        for ws, uid in list(peers.items()):
            if uid==u.id: await ws.close(code=1000)
    return {'ok':True}
class RoomInput(BaseModel): name:str=Field(min_length=1,max_length=60)
def room_data(r,s):
    return {'code':r.code,'name':r.name,'red_id':r.red_id,'black_id':r.black_id,'red_name':s.get(User,r.red_id).username,'black_name':s.get(User,r.black_id).username if r.black_id else None,'board':r.board,'turn':r.turn,'history':r.history,'status':r.status,'winner':r.winner,'version':r.version}
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
    for _ in range(20):
        code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
        if not s.get(Room,code):break
    b=initial();r=Room(code=code,name=data.name.strip() or 'Giao hữu',red_id=u.id,board=b,history=[],positions=[position_key(b,'r')]);s.add(r);s.commit();return room_data(r,s)
@app.get('/api/rooms')
def rooms(s:DB):
    # Only rooms whose owner is connected right now; abandoned waiting rooms would otherwise pile up forever.
    rows=s.scalars(select(Room).where(Room.status=='waiting').order_by(Room.created_at.desc().nulls_last()).limit(200))
    return [room_data(r,s) for r in rows if connections.get(r.code)][:50]
@app.get('/api/rooms/mine')
def my_rooms(u:Current,s:DB):
    rows=s.scalars(select(Room).where(or_(Room.red_id==u.id,Room.black_id==u.id),Room.status.in_(('waiting','playing'))).order_by(Room.created_at.desc().nulls_last()).limit(10))
    return [room_data(r,s) for r in rows]
@app.post('/api/rooms/{code}/join')
async def join(code:str,u:Current,s:DB):
    limit(('join',u.id),30,60)
    r=s.scalar(select(Room).where(Room.code==code.upper()).with_for_update())
    if not r:raise HTTPException(404,'Không tìm thấy mã phòng này.')
    if u.id not in (r.red_id,r.black_id):
        if r.black_id or r.status!='waiting':raise HTTPException(409,'Phòng đã đủ người hoặc đã kết thúc.')
        r.black_id=u.id;r.status='playing';r.version+=1
    s.commit();data=room_data(r,s);await broadcast(r.code,{'type':'state','room':data});return data
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
    return [{'id':i.id,'code':i.room_code,'sender':s.get(User,i.sender_id).username} for i in rows]
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
                    payload=d.get('data')
                    if not isinstance(payload,dict) or payload.get('kind') not in ('offer','answer','ice','hangup','busy'):raise ValueError('Tín hiệu không hợp lệ.')
                    await broadcast(code,{'type':'signal','data':payload},exclude=ws);continue
                with SessionLocal() as s:
                    r=s.scalar(select(Room).where(Room.code==code).with_for_update())
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
                        r.board=moved(r.board,f,t);r.history=r.history+[m];r.turn=other(side);r.version+=1
                        key=position_key(r.board,r.turn);r.positions=r.positions+[key]
                        if not has_moves(r.board,r.turn):r.status='finished';r.winner=side
                        elif r.positions.count(key)>=3:r.status='draw'
                    else:raise ValueError('Thao tác không được hỗ trợ.')
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
