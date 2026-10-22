"""Read-only public spectating. Run one worker, as required by the game server."""
import time
from fastapi import HTTPException, Response, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from . import main as m

TTL = 35
# One lease per browser tab, across all rooms. Never touches player sockets.
viewers = {}

class Visit(BaseModel):
    viewer: str = Field(min_length=36, max_length=36, pattern=r'^[0-9a-fA-F-]{36}$')

def prune():
    now = time.monotonic()
    for key, (_, stamp) in list(viewers.items()):
        if now - stamp > TTL: viewers.pop(key, None)

def count(code):
    return sum(room == code for room, _ in list(viewers.values()))

def no_cache(response):
    response.headers['Cache-Control'] = 'no-store'

def public_room(r, s, detail=False):
    # room_data is the public snapshot, NEVER personalize_coup or CoupState.identities.
    data = m.room_data(r, s)
    keys = ('code','name','red_name','black_name','red_profile','black_profile',
            'status','winner','turn','variant','clock','coins','server_time')
    result = {k:data[k] for k in keys if k in data}
    match = s.get(m.QuickMatch,r.code)
    # Private rooms also use QuickMatch for clocks, but have deadline=0.
    result.update(variant=data.get('variant','xiangqi'), source='random' if match and match.deadline > 0 else 'private',
                  viewers=count(r.code), move_count=len(r.history), server_time=time.time())
    if detail:
        result['board'] = list(r.board)
        # Explicit whitelist: hidden captures are public masked tokens, never revealed here.
        result['history'] = [{k:move[k] for k in ('from','to','piece','captured','revealed') if k in move} for move in r.history]
        result['version'] = r.version
    return result

@m.app.get('/api/spectate/rooms')
def live_rooms(response:Response, s:m.DB):
    no_cache(response); prune()
    rows=s.scalars(select(m.Room).where(m.Room.status=='playing',m.Room.black_id.is_not(None))).all()
    data=[public_room(r,s) for r in rows]
    data.sort(key=lambda r:(-r['viewers'],r['code']))
    return {'rooms':data,'total':len(data),'server_time':time.time()}

@m.app.get('/api/spectate/rooms/{code}')
def read_live_room(code:str, response:Response, s:m.DB):
    no_cache(response); prune()
    r=s.get(m.Room,code)
    if not r or r.status not in ('playing','finished','draw','cancelled') or not r.black_id:
        raise HTTPException(404,'Trận này chưa bắt đầu hoặc không còn tồn tại.')
    return public_room(r,s,True)

@m.app.post('/api/spectate/rooms/{code}/view')
def heartbeat(code:str, data:Visit, request:Request, response:Response, s:m.DB):
    no_cache(response); prune()
    m.limit(('spectate',m.client_ip(request)),240,60)
    r=s.get(m.Room,code)
    if not r or r.status not in ('playing','finished','draw','cancelled') or not r.black_id:
        raise HTTPException(404,'Trận này chưa bắt đầu hoặc không còn tồn tại.')
    if r.status=='playing':
        if data.viewer not in viewers and len(viewers)>=20000:raise HTTPException(503,'Khán đài đang đông, vui lòng thử lại.')
        viewers[data.viewer]=(code,time.monotonic())
    elif viewers.get(data.viewer, (None,))[0]==code:viewers.pop(data.viewer,None)
    return public_room(r,s,True)

@m.app.delete('/api/spectate/rooms/{code}/view')
def leave(code:str,data:Visit):
    if viewers.get(data.viewer,(None,))[0]==code:viewers.pop(data.viewer,None)
    return {'ok':True}
