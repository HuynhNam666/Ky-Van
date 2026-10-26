"""Per-tab tokens coexist with the existing cookie clients."""
from backend.test_backend import _host, main, ORIGIN
import pytest

@pytest.fixture(autouse=True)
def limits():main.limits.clear()

def headers(token=None):
    h={**ORIGIN,'X-Session-Mode':'tab'}
    if token:h['Authorization']='Bearer '+token
    return h

def test_two_tab_sessions_keep_independent_users_and_match():
    tokens=[];users=[]
    for name in ['tab_auth_first','tab_auth_second']:
        r=_host.post('/api/auth/register',json={'username':name,'password':'test-tab-password'},headers=headers())
        assert r.status_code==200,r.text
        assert 'session' not in r.cookies
        data=r.json();tokens.append(data['access_token']);users.append(data['id'])
    for token,uid in zip(tokens,users):assert _host.get('/api/auth/me',headers=headers(token)).json()['id']==uid
    # A shared cookie must not silently authenticate a fresh tab.
    _host.cookies.set('session',tokens[0])
    assert _host.get('/api/auth/me',headers=headers()).status_code==401
    assert _host.get('/api/auth/me',headers=headers('invalid-token')).status_code==401
    assert _host.post('/api/matchmaking/join',headers=headers(tokens[0])).json()['status']=='searching'
    match=_host.post('/api/matchmaking/join',headers=headers(tokens[1])).json()['room']
    assert {match['red_id'],match['black_id']}==set(users)
    assert match['status']=='ready'
    assert _host.delete('/api/matchmaking/queue',headers=headers(tokens[0])).status_code==200
    assert _host.post('/api/auth/logout',headers=headers(tokens[0])).status_code==200
    assert _host.get('/api/auth/me',headers=headers(tokens[1])).json()['id']==users[1]
    login=_host.post('/api/auth/login',json={'username':'tab_auth_first','password':'test-tab-password'},headers=headers())
    assert login.status_code==200 and login.json()['access_token']
    assert _host.get('/api/auth/me',headers=headers(login.json()['access_token'])).json()['id']==users[0]
    _host.cookies.clear()
