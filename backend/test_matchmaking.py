"""Two real authenticated websocket clients; no fake opponent or client-side timer authority."""
import time
import pytest
from sqlalchemy import select
from backend.test_backend import client, wsurl, until, ORIGIN, main

@pytest.fixture(autouse=True)
def reset_limits_and_queue():
    main.limits.clear()
    with main.SessionLocal() as s:
        for q in s.scalars(select(main.QuickQueue)):s.delete(q)
        s.commit()

def match(prefix):
    a,b=client(prefix+'_a'),client(prefix+'_b')
    assert a.post('/api/matchmaking/join').json()['status']=='searching'
    # Duplicate join cannot create a self match.
    assert a.post('/api/matchmaking/join').json()['status']=='searching'
    r=b.post('/api/matchmaking/join').json()['room']
    assert r['status']=='ready' and r['red_id']!=r['black_id']
    assert a.get('/api/matchmaking/status').json()['room']['code']==r['code']
    assert a.post('/api/matchmaking/join').json()['room']['code']==r['code']
    return a,b,r

def test_ready_moves_chat_emotions_and_draw():
    a,b,r=match('quick_full');code=r['code']
    outsider=client('quick_outside')
    assert outsider.get('/api/rooms/'+code).status_code==403
    aid=a.get('/api/auth/me').json()['id']
    with a.websocket_connect(wsurl(a,code),headers=ORIGIN) as wa,b.websocket_connect(wsurl(b,code),headers=ORIGIN) as wb:
        until(wa,'state');until(wb,'state')
        wa.send_json({'type':'move','from':54,'to':45,'version':r['version']})
        assert until(wa,'error')
        wa.send_json({'type':'ready'});r=until(wa,'state')['room'];until(wb,'state')
        assert r['status']=='ready' and (r['red_ready']!=r['black_ready'])
        wb.send_json({'type':'ready'});r=until(wa,'state')['room'];until(wb,'state')
        assert r['status']=='playing' and r['turn']=='r'
        red,black=(wa,wb) if aid==r['red_id'] else (wb,wa)
        red.send_json({'type':'move','from':54,'to':45,'version':r['version']})
        r=until(wa,'state')['room'];rb=until(wb,'state')['room']
        assert r==rb and r['board'][45]=='rP' and r['turn']=='b'
        wa.send_json({'type':'chat','text':'Chào bạn, chúc ván cờ vui!'})
        assert until(wa,'chat')['message']==until(wb,'chat')['message']
        wb.send_json({'type':'reaction','emoji':'👏'})
        assert until(wa,'reaction')['emoji']=='👏';until(wb,'reaction')
        wa.send_json({'type':'signal','data':{'kind':'offer','sdp':{'type':'offer','sdp':'test'}}})
        assert until(wb,'signal')['data']['kind']=='offer'
        wa.send_json({'type':'draw_offer'});assert until(wa,'state')['room']['draw_by']==aid;until(wb,'state')
        wa.send_json({'type':'draw_accept'});assert until(wa,'error')
        wb.send_json({'type':'draw_accept'});assert until(wa,'state')['room']['status']=='draw';until(wb,'state')

def test_timeout_is_server_enforced_without_browser_timer():
    a,b,r=match('quick_timeout');code=r['code']
    with main.SessionLocal() as s:
        q=s.get(main.QuickMatch,code);q.deadline=time.time()-.1;s.commit()
    # Sweeper OR status request expires the room authoritatively.
    a.get('/api/matchmaking/status')
    result=b.get('/api/rooms/'+code).json()
    assert result['status']=='cancelled' and '30' in result['cancel_reason']
    with a.websocket_connect(wsurl(a,code),headers=ORIGIN) as w:
        until(w,'state');w.send_json({'type':'ready'});assert until(w,'error')

def test_cancel_ready_and_stale_queue():
    a,b,r=match('quick_cancel')
    assert a.delete('/api/matchmaking/queue').status_code==200
    assert b.get('/api/rooms/'+r['code']).json()['status']=='cancelled'
    assert a.post('/api/matchmaking/join').json()['status']=='searching'
    with main.SessionLocal() as s:
        q=s.get(main.QuickQueue,a.get('/api/auth/me').json()['id']);q.heartbeat=time.time()-60;s.commit()
    assert b.post('/api/matchmaking/join').json()['status']=='searching'
    assert a.get('/api/matchmaking/status').json()['status']=='idle'
    b.delete('/api/matchmaking/queue')

def test_leave_counts_as_loss_and_reload_returns_same_room():
    a,b,r=match('quick_leave');code=r['code'];aid=a.get('/api/auth/me').json()['id']
    with a.websocket_connect(wsurl(a,code),headers=ORIGIN) as wa,b.websocket_connect(wsurl(b,code),headers=ORIGIN) as wb:
        until(wa,'state');until(wb,'state')
        wa.send_json({'type':'ready'});until(wa,'state');until(wb,'state')
        wb.send_json({'type':'ready'});r=until(wa,'state')['room'];until(wb,'state')
        assert a.post('/api/matchmaking/join').json()['room']['code']==code
        assert a.delete('/api/matchmaking/queue').status_code==409
        wa.send_json({'type':'leave'});r=until(wb,'state')['room']
        assert r['status']=='finished' and r['winner']==('b' if aid==r['red_id'] else 'r')
