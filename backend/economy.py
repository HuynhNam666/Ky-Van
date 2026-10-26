"""Free, non-redeemable game coins; all accounting is server-side."""
import hashlib, hmac, random
from datetime import datetime, timezone, timedelta
from sqlalchemy import String, Integer, JSON, ForeignKey, select
from sqlalchemy.orm import Mapped, mapped_column
from fastapi import HTTPException
from pydantic import BaseModel
from .main import Base, User, Room, engine, SECRET, app, Current, DB

VN = timezone(timedelta(hours=7))
WELCOME = 1000
MIN_STAKE = 100
class Wallet(Base):
    __tablename__='coin_wallets'
    user_id: Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
    coins: Mapped[int]=mapped_column(Integer,default=WELCOME)
    points: Mapped[int]=mapped_column(Integer,default=0)
class CoinMatch(Base):
    __tablename__='coin_matches'
    code: Mapped[str]=mapped_column(ForeignKey('rooms.code'),primary_key=True)
    stake: Mapped[int]=mapped_column(Integer)
    settled: Mapped[int]=mapped_column(Integer,default=0)
    red_payout: Mapped[int]=mapped_column(Integer,default=0)
    black_payout: Mapped[int]=mapped_column(Integer,default=0)
class CoinEntry(Base):
    __tablename__='coin_entries'
    key: Mapped[str]=mapped_column(String(160),primary_key=True)
    user_id: Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
    amount: Mapped[int]=mapped_column(Integer)
    reason: Mapped[str]=mapped_column(String(100))
    stamp: Mapped[str]=mapped_column(String(40))
class DailyQuest(Base):
    __tablename__='daily_quests'
    key: Mapped[str]=mapped_column(String(64),primary_key=True)
    user_id: Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
    day: Mapped[str]=mapped_column(String(10))
    tasks: Mapped[list]=mapped_column(JSON)
    counters: Mapped[dict]=mapped_column(JSON,default=dict)
    claimed: Mapped[list]=mapped_column(JSON,default=list)
Base.metadata.create_all(engine)

def today():return datetime.now(VN).date().isoformat()
def wallet(s,uid):
    # Lock the stable parent row even before the wallet exists.
    s.scalar(select(User).where(User.id==uid).with_for_update())
    w=s.get(Wallet,uid)
    if not w:
        w=Wallet(user_id=uid,coins=WELCOME,points=0);s.add(w)
        s.add(CoinEntry(key=f'welcome:{uid}',user_id=uid,amount=WELCOME,reason='Quà tân thủ',stamp=datetime.now(VN).isoformat()))
        s.flush()
    return w

def change(s,uid,amount,key,reason):
    w=wallet(s,uid)
    if s.get(CoinEntry,key):return False
    if w.coins+amount<0:raise HTTPException(409,'Không đủ xu. Hãy nhận nhiệm vụ miễn phí trong ngày.')
    w.coins+=amount
    s.add(CoinEntry(key=key,user_id=uid,amount=amount,reason=reason,stamp=datetime.now(VN).isoformat()))
    s.flush();return True

def task(key,title,metric,target,reward):return dict(id=key,title=title,metric=metric,target=target,reward=reward)
BASE_TASKS=[task('login','Điểm danh hôm nay','login',1,100),task('rules','Đọc luật tính xu','rules',1,100),task('puzzle','Giải câu hỏi khai cuộc','puzzle',1,100)]
POOL=[task('ready1','Bắt đầu 1 trận ngẫu nhiên','starts',1,50),task('ready3','Bắt đầu 3 trận ngẫu nhiên','starts',3,100),
 task('move5','Đi 5 nước hợp lệ','moves',5,50),task('move15','Đi 15 nước hợp lệ','moves',15,100),task('move30','Đi 30 nước hợp lệ','moves',30,150),
 task('capture1','Ăn 1 quân đối phương','captures',1,50),task('capture3','Ăn 3 quân đối phương','captures',3,100),
 task('game1','Hoàn thành 1 trận, tự đi ít nhất 3 nước','games',1,100),task('game3','Hoàn thành 3 trận, mỗi trận tự đi ít nhất 3 nước','games',3,200),
 task('win1','Thắng 1 trận, tự đi ít nhất 3 nước','wins',1,150)]

def daily(s,uid):
    key=f'{uid}:{today()}';d=s.get(DailyQuest,key)
    if not d:
        seed=hmac.new(SECRET.encode(),key.encode(),hashlib.sha256).digest()
        rng=random.Random(seed)
        d=DailyQuest(key=key,user_id=uid,day=today(),tasks=BASE_TASKS+rng.sample(POOL,rng.randint(4,7)),counters={'login':1},claimed=[])
        s.add(d);s.flush()
    return d

def progress(s,uid,metric,count=1):
    wallet(s,uid);d=daily(s,uid)
    d.counters={**d.counters,metric:d.counters.get(metric,0)+count}

def start_coins(s,r):
    for uid in (r.red_id,r.black_id):progress(s,uid,'starts')

def move_coins(s,uid,captured):
    progress(s,uid,'moves')
    if captured:progress(s,uid,'captures')

def stake_for(a,b):
    low=min(a,b)
    return 1000 if low>=25000 else 500 if low>=10000 else 250 if low>=5000 else 100

def reserve_coins(s,r,requested=None):
    if s.get(CoinMatch,r.code):return
    balances={uid:wallet(s,uid).coins for uid in sorted((r.red_id,r.black_id))}
    stake=stake_for(*balances.values())
    if requested is not None:stake=requested
    if stake not in (100,250,500,1000):raise HTTPException(400,'Mức cược phải là 100, 250, 500 hoặc 1.000 xu.')
    if min(balances.values())<stake:raise HTTPException(409,'Một trong hai người chơi không đủ xu cho mức cược đã chọn.')
    for uid in sorted(balances):change(s,uid,-stake,f'hold:{r.code}:{uid}','Giữ xu bàn '+r.code)
    s.add(CoinMatch(code=r.code,stake=stake))

def settle_coins(s,r):
    if r.status not in ('finished','draw','cancelled'):return
    c=s.scalar(select(CoinMatch).where(CoinMatch.code==r.code).with_for_update())
    if not c or c.settled:return
    for uid in sorted((r.red_id,r.black_id)):wallet(s,uid)
    if r.status in ('draw','cancelled'):red=black=c.stake
    else:
        red=2*c.stake if r.winner=='r' else 0
        black=2*c.stake if r.winner=='b' else 0
    for uid,amount in ((r.red_id,red),(r.black_id,black)):
        change(s,uid,amount,f'settle:{r.code}:{uid}','Kết toán bàn '+r.code)
        own_moves=sum(m['piece'][0]==('r' if uid==r.red_id else 'b') for m in r.history)
        if r.status in ('finished','draw') and own_moves>=3:
            progress(s,uid,'games')
            if amount==2*c.stake:progress(s,uid,'wins')
    c.red_payout=red;c.black_payout=black;c.settled=1

def coin_data(r,s):
    c=s.get(CoinMatch,r.code)
    if not c:return {}
    return {'coins':{'stake':c.stake,'pot':2*c.stake,'settled':bool(c.settled),'red_payout':c.red_payout,'black_payout':c.black_payout}}

def snapshot(s,uid):
    w=wallet(s,uid);d=daily(s,uid)
    midnight=datetime.combine(datetime.now(VN).date()+timedelta(days=1),datetime.min.time(),tzinfo=VN)
    tasks=[{**t,'progress':min(t['target'],d.counters.get(t['metric'],0)),'claimed':t['id'] in d.claimed} for t in d.tasks]
    held=sum(s.scalars(select(CoinMatch.stake).join(Room).where(CoinMatch.settled==0,((Room.red_id==uid)|(Room.black_id==uid)))))
    return {'coins':w.coins,'points':w.points,'held':held,'minimum_stake':MIN_STAKE,'day':d.day,'resets_at':midnight.isoformat(),'tasks':tasks,
        'puzzle':{'question':'Ở khai cuộc, Tốt Đỏ a4 được đi đến ô nào?','choices':['a5','b4','a3']}}

@app.get('/api/economy')
# ORIGINAL | async def get_economy(u:Current,s:DB):
def get_economy(u:Current,s:DB):
    data=snapshot(s,u.id);s.commit();return data
class QuestAction(BaseModel):
    action:str
    answer:str=''
@app.post('/api/economy/action')
# ORIGINAL | async def quest_action(data:QuestAction,u:Current,s:DB):
def quest_action(data:QuestAction,u:Current,s:DB):
    wallet(s,u.id)
    if data.action=='rules':progress(s,u.id,'rules')
    elif data.action=='puzzle':
        if data.answer!='a5':raise HTTPException(400,'Chưa đúng. Tốt Đỏ đi thẳng về phía đối phương một ô.')
        progress(s,u.id,'puzzle')
    else:raise HTTPException(400,'Nhiệm vụ không hợp lệ.')
    result=snapshot(s,u.id);s.commit();return result
class Claim(BaseModel):
    day:str
    task_id:str
@app.post('/api/economy/claim')
# ORIGINAL | async def claim_quest(data:Claim,u:Current,s:DB):
def claim_quest(data:Claim,u:Current,s:DB):
    wallet(s,u.id);d=daily(s,u.id)
    if data.day!=d.day:raise HTTPException(409,'Đã sang ngày mới. Hãy tải lại nhiệm vụ.')
    t=next((t for t in d.tasks if t['id']==data.task_id),None)
    if not t:raise HTTPException(404,'Không có nhiệm vụ này hôm nay.')
    if d.counters.get(t['metric'],0)<t['target']:raise HTTPException(409,'Bạn chưa hoàn thành nhiệm vụ.')
    if t['id'] not in d.claimed:
        if change(s,u.id,t['reward'],f'quest:{d.key}:{t["id"]}','Nhiệm vụ: '+t['title']):wallet(s,u.id).points+=1
        d.claimed=[*d.claimed,t['id']]
    result=snapshot(s,u.id);s.commit();return result
