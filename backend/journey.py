"""Post-game rematches, private replays and profile privacy. Existing games stay intact."""
import time,uuid,copy
from datetime import datetime,timezone
from sqlalchemy import String,Integer,JSON,ForeignKey,select,or_,func
from sqlalchemy.orm import Mapped,mapped_column
from fastapi import HTTPException,Response
from pydantic import BaseModel,Field
from . import main as m, rankings, coup

class ProfilePrivacy(m.Base):
    __tablename__='profile_privacy_v1'
    user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
    public_stats:Mapped[int]=mapped_column(Integer,default=1)
class ReplaySave(m.Base):
    __tablename__='replay_saves_v1'
    key:Mapped[str]=mapped_column(String(100),primary_key=True)
    user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
    data:Mapped[dict]=mapped_column(JSON)
    stamp:Mapped[str]=mapped_column(String(40))
class Rematch(m.Base):
    __tablename__='rematch_invites_v1'
    code:Mapped[str]=mapped_column(ForeignKey('rooms.code'),primary_key=True)
    request_id:Mapped[str]=mapped_column(String(36))
    sender_id:Mapped[int]=mapped_column(ForeignKey('users.id'))
    expires:Mapped[float]=mapped_column()
    status:Mapped[str]=mapped_column(String(20),default='pending')
    new_code:Mapped[str|None]=mapped_column(String(6),nullable=True)
m.Base.metadata.create_all(m.engine)

def done_room(s,code,uid):
    r=s.get(m.Room,code)
    if not r or uid not in (r.red_id,r.black_id):raise HTTPException(404,'Không tìm thấy ván cờ của bạn.')
    if r.status not in ('finished','draw'):raise HTTPException(409,'Ván đấu chưa kết thúc.')
    return r

def full_replay(r,s):
    return {'code':r.code,'name':r.name,'variant':'coup' if s.get(coup.CoupState,r.code) else 'xiangqi',
        'red_name':s.get(m.User,r.red_id).username,'black_name':s.get(m.User,r.black_id).username,
        'board':list(r.board),'history':copy.deepcopy(r.history),'winner':r.winner,'status':r.status,
        'turn':r.turn,'mode':'online'}

def is_public(s,uid):
    p=s.get(ProfilePrivacy,uid);return not p or bool(p.public_stats)

def safe_profile(s,uid,private=False):
    p=rankings.profile(s,uid)
    if not private and not is_public(s,uid):
        p={k:v for k,v in p.items() if k not in ('wins','losses','draws')}
    return p

def summary(r,s,uid):
    return {'code':r.code,'name':r.name,'variant':'coup' if s.get(coup.CoupState,r.code) else 'xiangqi',
        'opponent':s.get(m.User,r.black_id if r.red_id==uid else r.red_id).username,
        'outcome':'draw' if r.status=='draw' else 'win' if r.winner==('r' if r.red_id==uid else 'b') else 'loss',
        'moves':len(r.history),'created_at':r.created_at.isoformat() if r.created_at else None}

def stats(s,uid):
    rows=s.scalars(select(m.Room).where(or_(m.Room.red_id==uid,m.Room.black_id==uid),m.Room.status.in_(('finished','draw')))).all()
    wins=losses=draws=own=captures=0;variants={'xiangqi':0,'coup':0}
    for r in rows:
        side='r' if r.red_id==uid else 'b'
        if r.status=='draw':draws+=1
        elif r.winner==side:wins+=1
        else:losses+=1
        variants['coup' if s.get(coup.CoupState,r.code) else 'xiangqi']+=1
        for move in r.history:
            if move.get('piece','').startswith(side):
                own+=1
                if move.get('captured'):captures+=1
    n=len(rows)
    return dict(total=n,wins=wins,losses=losses,draws=draws,win_rate=round(100*wins/n,1) if n else 0,
                variants=variants,own_moves=own,captures=captures,
                radar=[round(100*wins/n,1) if n else 0,round(100*draws/n,1) if n else 0,
                       round(100*variants['xiangqi']/n,1) if n else 0,round(100*variants['coup']/n,1) if n else 0,
                       round(100*captures/own,1) if own else 0])

@m.app.get('/api/journey/me')
def mine(response:Response,u:m.Current,s:m.DB):
    response.headers['Cache-Control']='no-store'
    return {'user_id':u.id,'username':u.username,'profile':safe_profile(s,u.id,True),'stats':stats(s,u.id),'public_stats':is_public(s,u.id),'owner':True}

@m.app.get('/api/journey/players/{uid}')
def public_player(uid:int,response:Response,s:m.DB):
    response.headers['Cache-Control']='no-store'
    user=s.get(m.User,uid)
    if not user:raise HTTPException(404,'Không tìm thấy kỳ thủ.')
    return {'user_id':uid,'username':user.username,'profile':safe_profile(s,uid),'stats':stats(s,uid) if is_public(s,uid) else None,'public_stats':is_public(s,uid),'owner':False}

class PrivacyInput(BaseModel):public_stats:bool
@m.app.put('/api/journey/privacy')
def privacy(data:PrivacyInput,u:m.Current,s:m.DB):
    s.scalar(select(m.User).where(m.User.id==u.id).with_for_update())
    p=s.get(ProfilePrivacy,u.id)
    if not p:p=ProfilePrivacy(user_id=u.id);s.add(p)
    p.public_stats=int(data.public_stats);s.commit();return {'public_stats':bool(p.public_stats)}

@m.app.get('/api/journey/history')
def history(response:Response,u:m.Current,s:m.DB,page:int=1):
    response.headers['Cache-Control']='no-store'
    page=max(1,page);query=select(m.Room).where(or_(m.Room.red_id==u.id,m.Room.black_id==u.id),m.Room.status.in_(('finished','draw')))
    total=s.scalar(select(func.count()).select_from(query.subquery()))
    rows=s.scalars(query.order_by(m.Room.created_at.desc(),m.Room.code).offset((page-1)*20).limit(20)).all()
    return {'items':[summary(r,s,u.id) for r in rows],'total':total,'page':page}

@m.app.get('/api/journey/replay/{code}')
def replay(code:str,response:Response,u:m.Current,s:m.DB):
    response.headers['Cache-Control']='no-store';return full_replay(done_room(s,code,u.id),s)

@m.app.post('/api/journey/replay/{code}/save')
def save_replay(code:str,u:m.Current,s:m.DB):
    r=done_room(s,code,u.id)
    s.scalar(select(m.User).where(m.User.id==u.id).with_for_update())
    key=f'{u.id}:{code}';row=s.get(ReplaySave,key)
    if not row:
        row=ReplaySave(key=key,user_id=u.id,data=full_replay(r,s),stamp=datetime.now(timezone.utc).isoformat());s.add(row);s.commit()
    return {'key':key,'saved':True}

@m.app.get('/api/journey/saves')
def saves(response:Response,u:m.Current,s:m.DB,page:int=1):
    response.headers['Cache-Control']='no-store'
    page=max(1,page);query=select(ReplaySave).where(ReplaySave.user_id==u.id)
    total=s.scalar(select(func.count()).select_from(query.subquery()))
    rows=s.scalars(query.order_by(ReplaySave.stamp.desc()).offset((page-1)*20).limit(20)).all()
    return {'items':[{'key':r.key,'stamp':r.stamp,**{k:r.data.get(k) for k in ('name','code','variant','mode','red_name','black_name')},'moves':len(r.data.get('history',[]))} for r in rows],'total':total,'page':page}

@m.app.get('/api/journey/saves/{key}')
def saved_replay(key:str,response:Response,u:m.Current,s:m.DB):
    response.headers['Cache-Control']='no-store';row=s.get(ReplaySave,key)
    if not row or row.user_id!=u.id:raise HTTPException(404,'Không tìm thấy bản lưu của bạn.')
    return row.data

# Local/AI replays are explicitly unranked, never counted toward online statistics.
class LocalReplay(BaseModel):
    id:str=Field(pattern=r'^[0-9a-f-]{36}$')
    data:dict
@m.app.post('/api/journey/local-save')
def local_save(data:LocalReplay,u:m.Current,s:m.DB):
    d=data.data;b=d.get('board');h=d.get('history')
    valid=lambda p:p is None or isinstance(p,str) and p in {side+kind for side in 'rb' for kind in ('K','A','E','H','R','C','P')}
    if not isinstance(b,list) or len(b)!=90 or not all(valid(p) for p in b) or not isinstance(h,list) or len(h)>5000:raise HTTPException(400,'Biên bản không hợp lệ.')
    clean=[]
    for x in h:
        if not isinstance(x,dict) or any(type(x.get(k)) is not int or not 0<=x[k]<90 for k in ('from','to')) or x['from']==x['to'] or not x.get('piece') or not valid(x['piece']) or not valid(x.get('captured')):raise HTTPException(400,'Nước đi không hợp lệ.')
        clean.append({k:x.get(k) for k in ('from','to','piece','captured')})
    restored=list(b)
    for x in reversed(clean):
        if restored[x['from']] is not None or restored[x['to']]!=x['piece']:raise HTTPException(400,'Biên bản không khớp với bàn cờ cuối.')
        restored[x['from']]=x['piece'];restored[x['to']]=x['captured']
    s.scalar(select(m.User).where(m.User.id==u.id).with_for_update())
    key=f'{u.id}:local:{data.id}'
    if not s.get(ReplaySave,key):
        payload={'code':data.id,'name':'Ván luyện tập / chơi tại máy','variant':'xiangqi','mode':'local','red_name':'Quân Đỏ','black_name':'Quân Đen','board':b,'history':clean,'winner':None,'status':'finished','turn':d.get('turn','r')}
        s.add(ReplaySave(key=key,user_id=u.id,data=payload,stamp=datetime.now(timezone.utc).isoformat()));s.commit()
    return {'key':key,'saved':True}

def invite_data(row,uid):
    if not row:return {'status':'none','server_time':time.time()}
    if row.status=='pending' and time.time()>=row.expires:row.status='expired'
    return {'status':row.status,'request_id':row.request_id,'incoming':row.sender_id!=uid,'expires_at':row.expires,'server_time':time.time(),'new_code':row.new_code}

def available(s,uid):
    if s.scalar(select(m.Room).where(or_(m.Room.red_id==uid,m.Room.black_id==uid),m.Room.status.in_(('ready','playing')))):
        raise HTTPException(409,'Một kỳ thủ đang ở ván khác. Không thể tái đấu.')

@m.app.get('/api/journey/rematch/{code}')
def invite_status(code:str,response:Response,u:m.Current,s:m.DB):
    response.headers['Cache-Control']='no-store';done_room(s,code,u.id)
    row=s.get(Rematch,code);data=invite_data(row,u.id);s.commit();return data

@m.app.post('/api/journey/rematch/{code}')
async def invite(code:str,u:m.Current,s:m.DB):
    m.limit(('rematch',u.id),20,60)
    async with m.match_lock:
        r=done_room(s,code,u.id);row=s.get(Rematch,code);data=invite_data(row,u.id)
        if row and data['status'] in ('pending','accepted'):s.commit();return data
        for uid in sorted((r.red_id,r.black_id)):available(s,uid)
        if not row:row=Rematch(code=code);s.add(row)
        row.request_id=str(uuid.uuid4());row.sender_id=u.id;row.status='pending';row.new_code=None;row.expires=time.time()+60
        s.commit();return invite_data(row,u.id)

class Decision(BaseModel):
    request_id:str
    action:str
@m.app.post('/api/journey/rematch/{code}/decision')
async def decide(code:str,data:Decision,u:m.Current,s:m.DB):
    async with m.match_lock:
        old=done_room(s,code,u.id)
        row=s.scalar(select(Rematch).where(Rematch.code==code).with_for_update())
        if not row or row.request_id!=data.request_id:raise HTTPException(409,'Lời mời này không còn hiệu lực.')
        state=invite_data(row,u.id)
        if state['status']!='pending':s.commit();return state
        if data.action=='cancel':
            if row.sender_id!=u.id:raise HTTPException(403,'Chỉ người gửi được hủy lời mời.')
            row.status='cancelled';s.commit();return invite_data(row,u.id)
        if row.sender_id==u.id:raise HTTPException(403,'Không thể tự chấp nhận lời mời.')
        if data.action=='decline':row.status='declined';s.commit();return invite_data(row,u.id)
        if data.action!='accept':raise HTTPException(400,'Lựa chọn không hợp lệ.')
        for uid in sorted((old.red_id,old.black_id)):available(s,uid)
        from .economy import CoinMatch
        cm=s.get(CoinMatch,old.code);stake=cm.stake if cm else old.stake
        clock=s.get(m.MatchClock,old.code)
        total=clock.total_seconds if clock else old.total_seconds
        move=clock.move_seconds if clock else old.move_seconds
        # Alternate colors. Every cờ úp rematch receives a NEW secret shuffle.
        if s.get(coup.CoupState,old.code):
            new=coup.make_room(s,old.black_id,old.red_id,name=old.name,stake=stake,total=total,move=move,status='playing')
        else:
            b=m.initial();new=m.Room(code=coup.new_code(s),name=old.name,red_id=old.black_id,black_id=old.red_id,board=b,history=[],positions=[m.position_key(b,'r')],status='playing',total_seconds=total,move_seconds=move,stake=stake)
            s.add(new);s.flush()
        m.reserve_coins(s,new,stake)
        previous=s.get(m.QuickMatch,old.code)
        s.add(m.QuickMatch(code=new.code,red_ready=1,black_ready=1,deadline=time.time() if previous and previous.deadline>0 else 0))
        s.add(m.MatchClock(code=new.code,total_seconds=total,move_seconds=move,red_remaining=total,black_remaining=total,turn_started=time.time()))
        for uid in (new.red_id,new.black_id):coup.clear_queues(s,uid)
        m.start_coins(s,new);row.status='accepted';row.new_code=new.code;s.commit();return invite_data(row,u.id)

# Redact public stats from the old room/profile transports too, not only the new screen.
def install_journey(namespace):
    original=namespace['room_data']
    def room_with_privacy(r,s):
        data=original(r,s)
        for field,uid in (('red_profile',r.red_id),('black_profile',r.black_id)):
            if uid and field in data and data[field] and not is_public(s,uid):
                data[field]={k:v for k,v in data[field].items() if k not in ('wins','losses','draws')}
        return data
    namespace['room_data']=room_with_privacy
