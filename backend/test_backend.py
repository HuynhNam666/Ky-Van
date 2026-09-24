"""Run: python -m pytest backend/test_backend.py -q (isolated SQLite test DB).
To run the same suite on PostgreSQL set TEST_DATABASE_URL to an empty, disposable database
(postgresql+psycopg://user:pass@host:5432/db): the tests create users and rooms and never clean up."""
import os, tempfile
from pathlib import Path
import pytest
from sqlalchemy import create_engine, inspect, text
from starlette.websockets import WebSocketDisconnect
# ignore_cleanup_errors: on Windows SQLite keeps the file open until the interpreter exits.
_temp=tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
os.environ['DATABASE_URL']=os.environ.get('TEST_DATABASE_URL') or 'sqlite:///'+str(Path(_temp.name)/'test.db')
os.environ['JWT_SECRET']='test-only-secret-'+('x'*40)
os.environ['COOKIE_SECURE']='false'
os.environ['ALLOWED_ORIGINS']='http://localhost:3000'
os.environ['TRUSTED_PROXY_HOPS']='1'
from fastapi.testclient import TestClient
import backend.main as main
from backend.main import app, limits, migrate, client_ip
from backend.chess import initial, legal, moved, check
ORIGIN={'Origin':'http://localhost:3000'}

@pytest.fixture(autouse=True)
def fresh_limits():
    limits.clear()

def test_rules():
    b=initial()
    assert legal(b,54,45)  # pawn forward
    assert not legal(b,54,55)  # pawn before river
    assert legal(b,82,63)  # horse, clear leg
    b[73]='rP'; assert not legal(b,82,63)
    b=initial(); assert legal(b,64,1)  # cannon captures horse over cannon
    assert not legal(b,64,19)  # cannon cannot capture without screen
    b=initial(); b[73]='rP'; assert not legal(b,83,63)  # elephant eye blocked
    b=[None]*90;b[4]='bK';b[85]='rK';b[49]='rR'
    assert not legal(b,49,48)  # cannot expose flying generals
    assert not check(b,'r')
    b[49]=None;assert check(b,'r')

_host=TestClient(app,headers=ORIGIN)
_host.__enter__()
class Actor:
    def __init__(self): self.cookies={}
    def get(self,path): return _host.get(path,cookies=self.cookies)
    def post(self,path,**kwargs):
        r=_host.post(path,cookies=self.cookies,**kwargs)
        if 'session' in r.cookies:self.cookies['session']=r.cookies['session']
        if path.endswith('/logout'):self.cookies.clear();_host.cookies.clear()
        return r
    def delete(self,path): return _host.delete(path,cookies=self.cookies)
    def websocket_connect(self,path,**kwargs):return _host.websocket_connect(path,**kwargs)
def client(name):
    c=Actor()
    r=c.post('/api/auth/register',json={'username':name,'password':'test-password-0123'})
    assert r.status_code==200,r.text
    return c

def wsurl(c,code):
    ticket=c.post('/api/ws-ticket').json()['ticket']
    return f'/api/ws/{code}?ticket={ticket}'

def test_auth_rooms_chat_saves_and_authority():
    a=client('red_test');b=client('black_test');outsider=client('outside_test')
    assert a.get('/api/auth/me').json()['username']=='red_test'
    assert TestClient(app).post('/api/rooms',json={'name':'bad'}).status_code==403
    assert TestClient(app,headers=ORIGIN).post('/api/rooms',json={'name':'bad'}).status_code==401
    assert a.post('/api/auth/login',json={'username':'red_test','password':'wrong-password'}).status_code==401
    room=a.post('/api/rooms',json={'name':'Integration room'}).json();code=room['code']
    assert a.post(f'/api/rooms/{code}/invite',json={'username':'black_test'}).status_code==200
    assert b.get('/api/invitations').json()[0]['code']==code
    assert b.post(f'/api/rooms/{code}/join').status_code==200
    assert outsider.post(f'/api/rooms/{code}/join').status_code==409
    a_id,b_id=a.get('/api/auth/me').json()['id'],b.get('/api/auth/me').json()['id']
    with a.websocket_connect(wsurl(a,code),headers=ORIGIN) as wa, b.websocket_connect(wsurl(b,code),headers=ORIGIN) as wb:
        ra=wa.receive_json(); assert ra['room']['status']=='playing';wa.receive_json()
        assert wa.receive_json()=={'type':'presence','online':[a_id]}
        assert wa.receive_json()=={'type':'presence','online':sorted([a_id,b_id])}
        rb=wb.receive_json();wb.receive_json()
        assert wb.receive_json()=={'type':'presence','online':sorted([a_id,b_id])}
        wa.send_json({'type':'ping'});assert wa.receive_json()=={'type':'pong'}  # heartbeat is not rate limited as game traffic
        wb.send_json({'type':'move','from':27,'to':36,'version':1})
        assert wb.receive_json()['type']=='error'  # black out of turn
        wa.send_json({'type':'move','from':54,'to':55,'version':1})
        assert wa.receive_json()['type']=='error'
        wa.send_json({'type':'move','from':54,'to':45,'version':1})
        sa=wa.receive_json()['room'];sb=wb.receive_json()['room']
        assert sa==sb and sa['board'][45]=='rP' and sa['turn']=='b'
        wb.send_json({'type':'move','from':27,'to':36,'version':1})
        assert wb.receive_json()['type']=='error'  # stale version
        wb.send_json({'type':'move','from':27,'to':36,'version':2})
        sa=wa.receive_json()['room'];wb.receive_json();assert len(sa['history'])==2
        wa.send_json({'type':'chat','text':'Xin chào kỳ thủ'})
        assert wa.receive_json()['message']['text']=='Xin chào kỳ thủ'
        assert wb.receive_json()['message']['username']=='red_test'
        wa.send_json({'type':'signal','data':{'kind':'offer','sdp':{'type':'offer','sdp':'test-only'}}})
        assert wb.receive_json()['data']['kind']=='offer'
        payload={'name':'Saved integration','board':sa['board'],'turn':sa['turn'],'history':sa['history']}
        assert a.post('/api/saves',json=payload).status_code==200
        assert a.get('/api/saves').json()[0]['board']==sa['board']
        assert b.get('/api/saves').json()==[]
        wb.send_json({'type':'resign'})
        assert wa.receive_json()['room']['winner']=='r'
        assert wb.receive_json()['room']['status']=='finished'
    assert a.post('/api/auth/logout').status_code==200
    assert a.get('/api/auth/me').status_code==401

def until(w,kind,limit=6):
    """Read frames until one of the wanted type shows up (presence frames may interleave)."""
    for _ in range(limit):
        m=w.receive_json()
        if m['type']==kind:return m
    raise AssertionError('no '+kind+' frame')

class _Req:
    def __init__(self,xff=None,host='10.0.0.9'):
        self.headers={'x-forwarded-for':xff} if xff else {}
        self.client=type('C',(),{'host':host})()

def test_client_ip_trusts_only_the_configured_hop(monkeypatch):
    assert client_ip(_Req('1.1.1.1, 2.2.2.2'))=='2.2.2.2'  # 1 hop: the last entry was appended by our own proxy
    assert client_ip(_Req())=='10.0.0.9'  # no header: fall back to the socket peer
    monkeypatch.setattr(main,'PROXY_HOPS',2);assert client_ip(_Req('1.1.1.1, 2.2.2.2'))=='1.1.1.1'
    assert client_ip(_Req('9.9.9.9'))=='10.0.0.9'  # fewer entries than hops: the header cannot be trusted
    monkeypatch.setattr(main,'PROXY_HOPS',0);assert client_ip(_Req('1.1.1.1'))=='10.0.0.9'  # 0 = ignore X-Forwarded-For

def test_login_throttle_is_per_account_and_register_is_per_client():
    victim=client('victim_test')
    for _ in range(10):assert victim.post('/api/auth/login',json={'username':'victim_test','password':'wrong-password-1'}).status_code==401
    assert victim.post('/api/auth/login',json={'username':'victim_test','password':'test-password-0123'}).status_code==429  # that account is throttled...
    bystander=client('bystander_test')  # ...everybody else can still sign up and sign in from the same network path
    assert bystander.post('/api/auth/login',json={'username':'bystander_test','password':'test-password-0123'}).status_code==200
    flood={'X-Forwarded-For':'203.0.113.7'}
    for i in range(20):assert Actor().post('/api/auth/register',json={'username':f'flood_{i}_test','password':'test-password-0123'},headers=flood).status_code==200
    assert Actor().post('/api/auth/register',json={'username':'flood_20_test','password':'test-password-0123'},headers=flood).status_code==429
    assert Actor().post('/api/auth/register',json={'username':'calm_test','password':'test-password-0123'},headers={'X-Forwarded-For':'203.0.113.8'}).status_code==200

def test_lobby_lists_only_connected_owners_and_my_rooms_survive_reload():
    a=client('lobby_a_test');b=client('lobby_b_test')
    code=a.post('/api/rooms',json={'name':'Sảnh thử'}).json()['code']
    assert b.get('/api/rooms').json()==[]  # owner is not connected: abandoned rooms stay out of the lobby
    assert [r['code'] for r in a.get('/api/rooms/mine').json()]==[code]  # but the owner can always find the room again
    assert b.get('/api/rooms/mine').json()==[]
    with a.websocket_connect(wsurl(a,code),headers=ORIGIN) as wa:
        for _ in range(3):wa.receive_json()  # state, messages, presence
        assert [r['code'] for r in b.get('/api/rooms').json()]==[code]
        assert b.post(f'/api/rooms/{code}/join').status_code==200
    assert b.get('/api/rooms').json()==[]  # full rooms leave the lobby
    assert [r['code'] for r in b.get('/api/rooms/mine').json()]==[code]  # and belong to both players
    assert TestClient(app,headers=ORIGIN).get('/api/rooms/mine').status_code==401

def test_presence_follows_connections_without_faking_a_hangup():
    a=client('pres_a_test');b=client('pres_b_test')
    code=a.post('/api/rooms',json={'name':'Presence'}).json()['code'];b.post(f'/api/rooms/{code}/join')
    a_id,b_id=a.get('/api/auth/me').json()['id'],b.get('/api/auth/me').json()['id']
    with a.websocket_connect(wsurl(a,code),headers=ORIGIN) as wa:
        with b.websocket_connect(wsurl(b,code),headers=ORIGIN) as wb:
            assert until(wa,'presence')['online']==[a_id]
            assert until(wa,'presence')['online']==sorted([a_id,b_id])
            wa.send_json({'type':'signal','data':{'kind':'offer','sdp':{}}});assert until(wb,'signal')['data']['kind']=='offer'
        # b's socket dropped: a is told b is offline, and no synthetic hangup is relayed (calls survive short reconnects)
        m=wa.receive_json();assert m=={'type':'presence','online':[a_id]}

def test_second_tab_replaces_the_first_with_close_code_4001():
    a=client('tabs_a_test');code=a.post('/api/rooms',json={'name':'Hai tab'}).json()['code']
    with a.websocket_connect(wsurl(a,code),headers=ORIGIN) as w1:
        for _ in range(3):w1.receive_json()
        with a.websocket_connect(wsurl(a,code),headers=ORIGIN) as w2:
            for _ in range(3):w2.receive_json()
            with pytest.raises(WebSocketDisconnect) as e:w1.receive_json()
            assert e.value.code==4001  # the client must not auto-reconnect on this code
            w2.send_json({'type':'ping'});until(w2,'pong')  # the new tab keeps working

def test_saves_keep_mode_and_can_be_deleted_by_the_owner_only():
    a=client('save_a_test');b=client('save_b_test')
    payload={'name':'Với máy','board':initial(),'turn':'r','history':[],'mode':'ai'}
    saved=a.post('/api/saves',json=payload).json();assert saved['mode']=='ai'
    assert a.post('/api/saves',json={**payload,'mode':'cheat'}).status_code==422
    assert a.get('/api/saves').json()[0]['mode']=='ai'
    assert b.delete(f"/api/saves/{saved['id']}").status_code==404  # someone else's save
    assert a.delete(f"/api/saves/{saved['id']}").status_code==200
    assert a.get('/api/saves').json()==[]
    legacy=a.post('/api/saves',json={k:v for k,v in payload.items() if k!='mode'}).json();assert legacy['mode']=='local'

def test_migrate_adds_created_at_to_an_existing_rooms_table(tmp_path):
    eng=create_engine('sqlite:///'+str(tmp_path/'old.db'))
    with eng.begin() as c:c.execute(text('CREATE TABLE rooms (code VARCHAR(6) PRIMARY KEY)'))
    migrate(eng);migrate(eng)  # idempotent
    assert 'created_at' in {x['name'] for x in inspect(eng).get_columns('rooms')}
    eng.dispose()

def test_perft_matches_published_xiangqi_counts():
    """Every legal line of play from the opening: 44, 1920 and 79666 are the reference numbers for Xiangqi."""
    def moves(b,side):return [(f,t) for f,p in enumerate(b) if p and p[0]==side for t in range(90) if legal(b,f,t)]
    def perft(b,side,d):
        ms=moves(b,side)
        return len(ms) if d==1 else sum(perft(moved(b,f,t),'b' if side=='r' else 'r',d-1) for f,t in ms)
    assert [perft(initial(),'r',d) for d in (1,2,3)]==[44,1920,79666]
