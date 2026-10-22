"""Cờ úp adapter; uses existing websocket, clocks, economy, social and rank flows."""
import copy, secrets, time
from sqlalchemy import ForeignKey, JSON, select, or_
from sqlalchemy.orm import Mapped, mapped_column
from fastapi import HTTPException
from . import main as m
from . import coup_chess as rules

class CoupState(m.Base):
    __tablename__='coup_states_v1'
    code: Mapped[str]=mapped_column(ForeignKey('rooms.code'),primary_key=True)
    identities: Mapped[dict]=mapped_column(JSON)
    captures: Mapped[list]=mapped_column(JSON,default=list)

class CoupQueue(m.Base):
    __tablename__='coup_queue_v1'
    user_id: Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
    heartbeat: Mapped[float]=mapped_column()

m.Base.metadata.create_all(m.engine)

def clear_queues(s, uid):
    for model in (CoupQueue,m.QuickQueue):
        q=s.get(model,uid)
        if q:s.delete(q)

def new_code(s):
    while True:
        code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
        if not s.get(m.Room,code):return code

def make_room(s, uid, black=None, *, name='Cờ úp · Kỳ Viện', stake=100, total=900, move=60, status='waiting'):
    b,hidden=rules.initial()
    r=m.Room(code=new_code(s),name=name,red_id=uid,black_id=black,board=b,history=[],positions=[m.position_key(b,'r')],status=status,total_seconds=total,move_seconds=move,stake=stake)
    s.add(r);s.flush();s.add(CoupState(code=r.code,identities=hidden,captures=[]));s.flush()
    return r

def personalize(data,s,uid):
    """Return a copy. No caller can mutate a shared broadcast into leaking captures."""
    if not isinstance(data,dict) or data.get('variant')!='coup':return data
    state=s.get(CoupState,data['code'])
    if state is None:return data
    out={**data,'history':copy.deepcopy(data['history'])}
    for capture in state.captures:
        if capture['uid']==uid and 0<=capture['index']<len(out['history']):
            out['history'][capture['index']]['captured']=capture['piece']
            out['history'][capture['index']]['captured_covered']=True
    return out

@m.app.post('/api/coup/rooms')
async def create_coup_room(data:m.RoomInput,u:m.Current,s:m.DB):
    m.limit(('create',u.id),10,60)
    async with m.match_lock:
        if data.stake not in (100,250,500,1000):raise HTTPException(400,'Mức xu không hợp lệ.')
        if m.active_quick(s,u.id):raise HTTPException(409,'Hãy kết thúc trận hiện tại trước.')
        if m.wallet(s,u.id).coins<data.stake:raise HTTPException(409,'Bạn không đủ xu để tạo bàn này.')
        clear_queues(s,u.id)
        r=make_room(s,u.id,name=data.name.strip() or 'Cờ úp giao hữu',stake=data.stake,total=data.total_seconds,move=data.move_seconds)
        s.commit();return m.room_data(r,s)

@m.app.post('/api/coup/matchmaking/join')
async def join_coup_queue(u:m.Current,s:m.DB):
    m.limit(('match-join',u.id),20,60)
    async with m.match_lock:
        changed=m.expire_quick(s)
        active=m.active_quick(s,u.id)
        if active:result={'status':'matched','room':personalize(m.room_data(active,s),s,u.id)}
        else:
            if s.scalar(select(m.Room).where(or_(m.Room.red_id==u.id,m.Room.black_id==u.id),m.Room.status=='playing')):raise HTTPException(409,'Bạn còn một ván chưa kết thúc.')
            if m.wallet(s,u.id).coins<m.MIN_STAKE:raise HTTPException(409,'Bạn cần ít nhất 100 xu để ghép trận.')
            standard=s.get(m.QuickQueue,u.id)
            if standard:s.delete(standard)
            now=time.time()
            for stale in s.scalars(select(CoupQueue).where(CoupQueue.heartbeat<now-m.QUEUE_TTL)):s.delete(stale)
            entry=s.get(CoupQueue,u.id)
            if entry:entry.heartbeat=now
            else:s.add(CoupQueue(user_id=u.id,heartbeat=now))
            s.flush()
            candidates=[q.user_id for q in s.scalars(select(CoupQueue).where(CoupQueue.user_id!=u.id,CoupQueue.heartbeat>=now-m.QUEUE_TTL)) if not s.get(m.QuickQueue,q.user_id) and m.wallet(s,q.user_id).coins>=m.MIN_STAKE and not s.scalar(select(m.Room).where(or_(m.Room.red_id==q.user_id,m.Room.black_id==q.user_id),m.Room.status.in_(('ready','playing'))))]
            if not candidates:
                s.commit();result={'status':'searching'}
            else:
                opponent=secrets.choice(candidates)
                red,black=(u.id,opponent) if secrets.randbelow(2) else (opponent,u.id)
                r=make_room(s,red,black,total=m.MATCH_TOTAL_SECONDS,move=m.MATCH_MOVE_SECONDS,status='ready')
                s.add(m.QuickMatch(code=r.code,deadline=now+m.READY_SECONDS))
                s.add(m.MatchClock(code=r.code,total_seconds=m.MATCH_TOTAL_SECONDS,move_seconds=m.MATCH_MOVE_SECONDS,red_remaining=m.MATCH_TOTAL_SECONDS,black_remaining=m.MATCH_TOTAL_SECONDS))
                m.reserve_coins(s,r)
                for uid in (u.id,opponent):clear_queues(s,uid)
                s.commit();result={'status':'matched','room':m.room_data(r,s)}
    await m.publish_rooms(changed)
    return result

@m.app.get('/api/coup/matchmaking/status')
async def coup_status(u:m.Current,s:m.DB):
    async with m.match_lock:
        changed=m.expire_quick(s);r=m.active_quick(s,u.id)
        if r:result={'status':'matched','room':personalize(m.room_data(r,s),s,u.id)}
        else:
            q=s.get(CoupQueue,u.id)
            if q:q.heartbeat=time.time();s.commit()
            result={'status':'searching' if q else 'idle'}
    await m.publish_rooms(changed)
    return result

@m.app.delete('/api/coup/matchmaking/queue')
async def cancel_coup_queue(u:m.Current,s:m.DB):
    q=s.get(CoupQueue,u.id)
    if q:s.delete(q)
    # Existing flow checks whether the match started, refunds holds, and broadcasts.
    return await m.cancel_matchmaking(u,s)

def install_coup(namespace):
    original_room=namespace['room_data']; original_command=namespace['quick_command']; original_broadcast=namespace['broadcast']
    def room_with_variant(r,s):
        data=original_room(r,s)
        data['variant']='coup' if s.get(CoupState,r.code) else 'xiangqi'
        return data
    async def broadcast_with_privacy(code,data,exclude=None):
        if data.get('type')!='state' or data.get('room',{}).get('variant')!='coup':return await original_broadcast(code,data,exclude)
        with m.SessionLocal() as s:
            for ws,uid in list(m.connections.get(code,{}).items()):
                if ws is exclude:continue
                try:await ws.send_json({**data,'room':personalize(data['room'],s,uid)})
                except Exception:m.connections[code].pop(ws,None)
    async def command_with_variant(s,r,uid,d):
        state=s.get(CoupState,r.code)
        if d.get('type')!='move' or state is None:return await original_command(s,r,uid,d)
        if r.status!='playing':raise ValueError('Ván cờ chưa bắt đầu hoặc đã kết thúc.')
        side='r' if uid==r.red_id else 'b'
        if uid not in (r.red_id,r.black_id):raise ValueError('Bạn không thuộc phòng này.')
        if side!=r.turn:raise ValueError('Chưa đến lượt của bạn.')
        if d.get('version')!=r.version:raise ValueError('Bàn cờ đã thay đổi. Hãy chờ đồng bộ.')
        f,t=d.get('from'),d.get('to')
        if type(f)!=int or type(t)!=int or not(0<=f<90 and 0<=t<90):raise ValueError('Ô cờ không hợp lệ.')
        if not r.board[f] or r.board[f][0]!=side:raise ValueError('Không thể đi quân đối phương.')
        board,hidden,move,captured=rules.apply(r.board,state.identities,f,t)
        if captured:state.captures=state.captures+[{'index':len(r.history),'uid':uid,'piece':captured}]
        state.identities=hidden
        q=s.get(m.QuickMatch,r.code)
        if q:q.draw_by=None
        if m.coin_data(r,s):m.move_coins(s,uid,move['captured'])
        now=time.time();m.spend_clock(s,r,now,advance=True)
        r.board=board;r.history=r.history+[move];r.turn=m.other(side);r.version+=1
        key=m.position_key(board,r.turn);r.positions=r.positions+[key]
        if not rules.has_moves(board,r.turn):r.status='finished';r.winner=side
        elif r.positions.count(key)>=3:r.status='draw'
        if r.status in ('finished','draw'):m.spend_clock(s,r,now,stop=True)
        m.settle_coins(s,r);s.commit()
        await namespace['broadcast'](r.code,{'type':'state','room':namespace['room_data'](r,s)})
        return True
    namespace['room_data']=room_with_variant
    namespace['quick_command']=command_with_variant
    namespace['broadcast']=broadcast_with_privacy
    # Preserve original FastAPI dependencies; wrap only their callables.
    for route in m.app.routes:
        dep=getattr(route,'dependant',None)
        if dep is None:continue
        original=dep.call
        if original is namespace.get('join_matchmaking'):
            async def normal_join(u,s,_original=original):
                q=s.get(CoupQueue,u.id)
                if q:s.delete(q);s.commit()
                result=await _original(u,s)
                if result.get('room'):result={**result,'room':personalize(result['room'],s,u.id)}
                return result
            dep.call=normal_join
        elif original is namespace.get('cancel_matchmaking'):
            async def normal_cancel(u,s,_original=original):
                q=s.get(CoupQueue,u.id)
                if q:s.delete(q)
                return await _original(u,s)
            dep.call=normal_cancel
        elif original is namespace.get('create_room'):
            def normal_create(data,u,s,_original=original):
                q=s.get(CoupQueue,u.id)
                if q:s.delete(q)
                return _original(data,u,s)
            dep.call=normal_create
        elif original is namespace.get('join'):
            async def room_join(code,u,s,_original=original):
                q=s.get(CoupQueue,u.id)
                if q:s.delete(q)
                return personalize(await _original(code,u,s),s,u.id)
            dep.call=room_join
        elif original is namespace.get('read_room'):
            async def room_read(code,u,s,_original=original):return personalize(await _original(code,u,s),s,u.id)
            dep.call=room_read
        elif original is namespace.get('matchmaking_status'):
            async def normal_status(u,s,_original=original):
                result=await _original(u,s)
                if result.get('room'):result={**result,'room':personalize(result['room'],s,u.id)}
                return result
            dep.call=normal_status
        elif getattr(route,'path','')=='/api/rooms/{code}/preview':
            def preview(code,u,s,_original=original):
                # Original preview is synchronous in the current backend.
                result=_original(code,u,s)
                return {**result,'variant':'coup' if s.get(CoupState,code.upper()) else 'xiangqi'}
            dep.call=preview

@m.app.on_event('startup')
async def clear_stale_coup_queue():
    with m.SessionLocal() as s:
        for q in s.scalars(select(CoupQueue)):s.delete(q)
        s.commit()
