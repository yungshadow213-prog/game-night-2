const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
app.use(express.json({limit:'3mb'}));
app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const DATA_FILE = path.join(__dirname, 'gamenight-data.json');
let sharedData = {};
try { sharedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { sharedData = {}; }
function saveData(){ try { fs.writeFileSync(DATA_FILE, JSON.stringify(sharedData, null, 2)); } catch {} }
function token(){ return require('crypto').randomBytes(18).toString('hex'); }
function ensureConnections(){ if(!sharedData.connections) sharedData.connections={}; }
function ensureUsers(){ if(!sharedData.users) sharedData.users={}; }
function ensureAuthSessions(){ if(!sharedData.authSessions) sharedData.authSessions={}; }
ensureConnections(); ensureUsers(); ensureAuthSessions();
function makePlayerTag(name){
  const base=String(name||'PLAYER').replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,4)||'PLAY';
  let tag='@'+base+Math.floor(1000+Math.random()*9000);
  const used=new Set(Object.values(sharedData.users).map(u=>u.playerTag));
  while(used.has(tag)) tag='@'+base+Math.floor(1000+Math.random()*9000);
  return tag;
}
function levelFromXp(xp){ return Math.max(1,Math.floor((Number(xp)||0)/100)+1); }
function publicUser(u){ if(!u)return null; return {accountId:u.accountId,playerTag:u.playerTag,name:u.name||'Player',avatar:u.avatar||'🌙',level:levelFromXp(u.xp),xp:u.xp||0,stats:u.stats||{games:0,wins:0,losses:0,points:0,bestStreak:0}}; }
function upsertUser(accountId, profile={}){
  ensureUsers();
  let u=sharedData.users[accountId];
  if(!u){ u={accountId,playerTag:makePlayerTag(profile.name),name:clean(profile.name,20)||'Player',avatar:safeAvatar(profile.avatar),xp:0,stats:{games:0,wins:0,losses:0,points:0,bestStreak:0},createdAt:Date.now(),updatedAt:Date.now()}; sharedData.users[accountId]=u; }
  if(profile.name)u.name=clean(profile.name,20)||u.name;
  if(profile.avatar)u.avatar=safeAvatar(profile.avatar);
  u.updatedAt=Date.now(); saveData(); return u;
}
function accountIdForSession(session){ ensureAuthSessions(); const id=sharedData.authSessions?.[clean(session,120)]; return id||null; }
function createAuthSession(accountId){ ensureAuthSessions(); const t=token()+token(); sharedData.authSessions[t]={accountId,createdAt:Date.now()}; saveData(); return t; }
function authUserFromRequest(req){ const h=String(req.headers.authorization||''); const t=h.startsWith('Bearer ')?h.slice(7).trim():''; const id=accountIdForSession(t); return id?sharedData.users[id]:null; }
async function verifyGoogleCredential(credential){
  const clientId=process.env.GOOGLE_CLIENT_ID;
  if(!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured on the server.');
  const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(credential));
  if(!r.ok) throw new Error('Google credential could not be verified.');
  const d=await r.json();
  if(d.aud!==clientId) throw new Error('Google client mismatch.');
  if(d.iss!=='https://accounts.google.com' && d.iss!=='accounts.google.com') throw new Error('Invalid Google issuer.');
  if(d.exp && Number(d.exp)*1000<Date.now()) throw new Error('Google credential expired.');
  if(!d.sub) throw new Error('Google account identifier missing.');
  return d;
}
app.get('/api/health',(req,res)=>res.json({ok:true,app:'Game Night',version:'main-1.2'}));
app.get('/api/config',(req,res)=>res.json({googleClientId:process.env.GOOGLE_CLIENT_ID||''}));
app.get('/api/me',(req,res)=>{ const u=authUserFromRequest(req); if(!u)return res.status(401).json({authenticated:false}); res.json({authenticated:true,user:publicUser(u)}); });
app.post('/api/auth/google',async(req,res)=>{ try{ const d=await verifyGoogleCredential(req.body?.credential); const u=upsertUser('google:'+d.sub,{name:d.name,avatar:null}); const session=createAuthSession(u.accountId); res.json({session,user:publicUser(u)}); }catch(e){ res.status(401).json({error:e.message||'Google sign-in failed.'}); } });

const AVATARS = ['🌙','✨','🦋','🐈','🐼','🦊','🐰','🐻','🐱','🌸','⭐','🍓','🎀','🩷','🖤','🌌'];
const QUESTIONS = {
  "Would You Rather": [
    "Okay, be honest: would you rather have a chill night or randomly turn the night into chaos?",
    "Would you rather get a funny message or one that actually makes you smile?",
    "Would you rather match avatars or match wallpapers?",
    "Would you rather be teased a little or get an embarrassingly big compliment?",
    "Would you rather talk for hours or play ‘one more round’ until we forget the time?",
    "Would you rather let me choose the plan or make the plan yourself?",
    "Would you rather replay our funniest moment or make a new ridiculous one?",
    "What would you pick if you had to choose our whole vibe tonight?",
    "Would you rather win the game or make the other person laugh while losing?",
    "Would you rather get a surprise question or know what is coming?",
    "If we both said ‘quick game’, who do you think would actually stop first?",
    "Be honest: who is more likely to say ‘I’m not being dramatic’ while being dramatic?"
  ],
  "How Well Do You Know Me?": [
    "If you actually know me, what kind of message would fix my mood fastest?",
    "What would I probably do if I suddenly had a completely free evening?",
    "What tiny thing could I get weirdly competitive about?",
    "What kind of compliment would actually stick in my head?",
    "What do you think I pretend not to care about but definitely do?",
    "If I had to choose between sleep and one more interesting conversation, what am I picking?",
    "What kind of game would I choose first without even thinking?",
    "What would probably make me laugh at the worst possible time?",
    "What kind of surprise would I genuinely enjoy instead of just saying ‘thanks’?",
    "What is one thing you think I notice even when I act like I didn’t?",
    "What vibe do you think I bring when I’m bored: chill, chaotic, or ‘let’s do something’?",
    "What phrase do you think I say way too much?"
  ],
  "Guess My Answer": [
    "If I could choose the plan right now, what am I picking?",
    "Funny, sweet, or dramatic — which kind of compliment would I choose?",
    "If we have an hour, am I talking or gaming?",
    "What snack would I probably grab first for a movie night?",
    "What would I choose for a random late-night activity?",
    "If you dared me to do something harmless and ridiculous, would I actually do it?",
    "What would make me laugh fastest?",
    "Which one sounds most like me tonight: cozy, chaotic, playful, or sleepy?",
    "If I got a surprise, what kind would I secretly hope it was?",
    "Would I choose a long conversation or a quick game first?",
    "What kind of wallpaper would I actually keep for more than a day?",
    "What silly thing would I probably say I don’t care about when I obviously do?"
  ],
  "Couple Quiz": [
    "Who starts the random conversation more often?",
    "Who remembers the tiny details better?",
    "Who turns a normal game into a serious competition?",
    "Who sends the funny message first?",
    "Who can make the other person laugh when they are quiet?",
    "Who says ‘one more round’ and actually means five more rounds?",
    "Who is more likely to plan something without telling the other person?",
    "Who notices a mood change first?",
    "Who gives the most unnecessarily dramatic reaction?",
    "Who is more likely to save a funny message?",
    "Who would get competitive over something completely pointless?",
    "Okay, who is more dramatic? No diplomatic answers."
  ],
  "Truth or Dare — Lite": [
    "Truth: what is one thing you genuinely appreciate about the other player?",
    "Truth: what is a memory that still makes you laugh?",
    "Dare: give the other player the most ridiculous nickname you can think of.",
    "Dare: reply using only three emojis that somehow explain your mood.",
    "Truth: what tiny thing always makes your day better?",
    "Dare: give the other player a three-word compliment — no cheating.",
    "Truth: what harmless thing would you actually want us to try together?",
    "Dare: describe tonight using exactly five emojis.",
    "Truth: what is a quality you really value in someone close to you?",
    "Dare: make up the worst team name possible for both of us.",
    "Truth: what is a small surprise you would actually enjoy?",
    "Dare: give yourself a completely unnecessary award and make the speech dramatic."
  ],
  "Flirty / Teasing": [
    "Who gets shy first when the conversation suddenly gets extra sweet?",
    "What harmless thing does the other player do that you find really cute?",
    "Who starts the playful arguments just because they are funny?",
    "What kind of compliment would have you smiling for no reason?",
    "Who is more likely to randomly say ‘thinking of you’ first?",
    "What playful question would you ask if you knew the other person had to answer honestly?",
    "What kind of attention makes you feel appreciated?",
    "Who gives the most over-the-top compliments?",
    "What cute habit should the other player never stop doing?",
    "If our duo was a comedy show, what would the title be?",
    "What wholesome surprise would actually make you happy?",
    "Be honest: who denies being dramatic the most?"
  ],
  "Drawing Duel": [
    "Draw the other player as a game character.",
    "Draw us as a ridiculous cartoon duo.",
    "Draw the kind of place you would pick for a perfect hangout.",
    "Draw the funniest version of the other player you can get away with.",
    "Draw one symbol that somehow represents both of us.",
    "Draw the most dramatic compliment possible without writing the compliment.",
    "Draw something that would instantly make the other player laugh.",
    "Draw what our imaginary gaming setup would look like.",
    "Make up a mascot for the two of us.",
    "Draw a poster for the most chaotic Game Night ever.",
    "Draw the other player as the final boss.",
    "Draw who is more dramatic without using any words."
  ],
  "Music Swap": [
    "Pick a song vibe that sounds like you right now.",
    "What song would you play if you wanted to make the other person laugh?",
    "Pick something for a late-night chill session.",
    "What song would be our ridiculous victory theme?",
    "Pick a song that reminds you of a good memory.",
    "Pick a song title that would make a terrible but funny nickname for us.",
    "What song feels like a harmless challenge?",
    "Pick something you would actually put on our shared playlist.",
    "What song feels warm and comforting to you?",
    "Pick a song that matches our funniest moment.",
    "What song would fit the opening scene of our imaginary comedy?",
    "Pick a song that describes who is being dramatic today."
  ],
  "Watch Together": [
    "What would you actually pick for a watch night: comedy, anime, mystery, or something random?",
    "Who gets first pick — and why should I trust you?",
    "What kind of scene always makes you laugh?",
    "How good are we actually as a watch-party team?",
    "Do we pause every five minutes to react, or pretend we can behave?",
    "Pick one harmless challenge to make the watch night more chaotic.",
    "What snack are you bringing to the virtual watch party?",
    "Who is more likely to guess the ending way too early?",
    "What genre would genuinely surprise you if the other player picked it?",
    "If our watch party had a title, what would it be?",
    "What kind of wholesome scene would probably make you smile?",
    "Who would complain about spoilers first?"
  ],
  "Two Truths & A Lie": [
    "Give me three harmless facts and make the lie believable.",
    "Which fact about you would I probably refuse to believe at first?",
    "What weird little habit could you sneak into your truths?",
    "What hobby from when you were younger would make a good truth?",
    "What random food opinion could start an argument?",
    "Make one truth hilariously embarrassing — but harmless.",
    "What random talent would you claim if you had to impress me?",
    "What tiny achievement are you secretly proud of?",
    "What fictional skill would you steal if you could?",
    "What ridiculous prediction about yourself could actually come true?",
    "Can you hide a compliment inside one of your truths?",
    "Who is more likely to make their lie way too obvious?"
  ],
  "Reaction Race": [
    "What reaction are you sending after getting a surprise compliment?",
    "What reaction are you sending after losing by one point?",
    "What reaction fits a plot twist that makes absolutely no sense?",
    "What reaction are you sending when someone plans a surprise game night?",
    "What reaction do you give when someone calls you the MVP?",
    "Pick the reaction for a ridiculously dramatic but harmless tease.",
    "What reaction are you sending after a last-second win?",
    "What reaction fits a completely unexpected avatar change?",
    "What reaction would you send to a random ‘you awake?’ message?",
    "What reaction fits finally hitting a big streak?",
    "What reaction are you sending after a genuinely nice surprise?",
    "What reaction fits being called the dramatic one?"
  ],
  "Guess The Vibe": [
    "Guess my vibe right now: cozy, chaotic, playful, or sleepy?",
    "Which vibe do you think I bring to my favorite games?",
    "What would my ideal movie-night mood be?",
    "How do you think I would react to a random compliment?",
    "Would I pick a planned night or ‘let’s just see what happens’?",
    "Which harmless challenge do you think I would actually choose?",
    "What kind of chat do you think I would want right now?",
    "What music mood would I probably choose tonight?",
    "What would make me laugh fastest right now?",
    "Which color matches my current vibe best?",
    "What shared activity do you think I would pick first?",
    "Who do you think is secretly more competitive?"
  ],
  "Card Flip": [
    "Pick a card: compliment, memory, question, or challenge.",
    "Pick a card: funny, sweet, chaotic, or cozy.",
    "Pick a card for a surprise mini challenge.",
    "Pick a card for a memory you have to tell properly.",
    "Pick a card for a question you cannot answer with ‘idk’.",
    "Pick the card with the bravest harmless question.",
    "Pick a card for a two-player team challenge.",
    "Pick a card for a ridiculously dramatic compliment.",
    "Pick a card for a future hangout idea.",
    "Pick a card for a silly confession.",
    "Pick a card for something you genuinely appreciate.",
    "Pick the card that decides who is more dramatic."
  ],
  "Mini Tournament": [
    "Round 1: who wins a fast trivia battle?",
    "Round 2: who wins a reaction-speed challenge?",
    "Round 3: who would plan the better random night?",
    "Round 4: who remembers the tiny details better?",
    "Round 5: who can make the other person laugh faster?",
    "Bonus: who would actually say yes to a silly challenge?",
    "Who has the strongest MVP energy today?",
    "Who would choose the better soundtrack?",
    "Who would win a drawing duel?",
    "Who gives the better compliment?",
    "Who is more likely to keep the streak alive?",
    "Final call: who would demand the rematch first?"
  ],
  "Night Roulette": [
    "Tonight’s choice: chill chat or quick game?",
    "Tonight’s choice: music or movie?",
    "Tonight’s choice: compliment or challenge?",
    "Tonight’s choice: old memory or new idea?",
    "Tonight’s choice: calm or chaotic?",
    "Tonight’s choice: harmless daring question or silly dare?",
    "Tonight’s choice: drawing or trivia?",
    "Tonight’s choice: funny message or sweet message?",
    "Tonight’s choice: playlist or watch party?",
    "Tonight’s choice: something planned or completely random?",
    "Tonight’s choice: comedy vibe or adventure vibe?",
    "Tonight’s final question: who is more dramatic?"
  ]
};
const DATE_NIGHTS = [
  {title:'Cozy Movie Night', desc:'Pick a movie, grab snacks, and rate it together.'},
  {title:'Anime Night', desc:'Each person picks one episode. Then compare ratings.'},
  {title:'Music Swap', desc:'Take turns choosing songs and explain why you picked them.'},
  {title:'Question Roulette', desc:'Play 10 random questions from your favorite categories.'},
  {title:'Compliment Challenge', desc:'Give each other three genuine compliments, no repeats.'},
  {title:'Drawing Duel', desc:'Choose a silly prompt and draw for five minutes.'},
  {title:'Memory Lane', desc:'Take turns sharing favorite memories and funny moments.'},
  {title:'Two Truths & A Lie', desc:'Three statements each. Guess the lie.'},
  {title:'Mini Tournament', desc:'Play three quick games and crown the night champion.'},
  {title:'No-Plan Night', desc:'Flip a coin for every tiny decision and see where the night goes.'}
];

const clean = (v,n=100)=>String(v??'').replace(/[<>]/g,'').trim().slice(0,n);
const safeAvatar = v=>{const x=String(v||'');if(AVATARS.includes(x))return x;if(/^data:image\/(png|jpeg|webp);base64,/i.test(x)&&x.length<=2800000)return x;return '🌙';};
const makeCode=()=>Math.random().toString(36).slice(2,7).toUpperCase();
const dayKey=()=>new Date().toISOString().slice(0,10);

function roomStats(room){
  const scores=[...room.players.values()].map(p=>p.score);
  const top=Math.max(0,...scores);
  return { games:room.gamesPlayed, sharedPoints:room.sharedPoints, streak:room.streak, bestStreak:room.bestStreak, topScore:top };
}
function publicState(room){
  return {
    code:room.code,
    players:[...room.players.values()].map(p=>({id:p.id,accountId:p.accountId||null,playerTag:p.playerTag||null,name:p.name,avatar:p.avatar,level:p.level||1,xp:p.xp||0,ready:p.ready,score:p.score,personalStreak:p.personalStreak,answered:p.answered})),
    phase:room.phase, round:room.round, totalRounds:room.totalRounds,
    category:room.category, question:room.question, music:room.music,
    gameMode:room.gameMode, chatEnabled:room.chatEnabled,
    dateNight:room.dateNight, stats:roomStats(room)
  };
}
function broadcast(room){ io.to(room.code).emit('state', publicState(room)); }
function getRoom(socket){ return rooms.get(socket.data.room); }
function getPlayer(room,socket){ return room?.players.get(socket.id); }
function systemChat(room,text){
  const msg={system:true,text,time:Date.now()}; room.chat.push(msg); if(room.chat.length>150)room.chat.shift(); io.to(room.code).emit('chat',msg);
}
function chooseQuestion(room){
  const list=QUESTIONS[room.category]||QUESTIONS['Would You Rather'];
  return list[(room.round-1)%list.length];
}
function startRound(room){
  room.phase='game'; room.round++; room.question=chooseQuestion(room);
  room.players.forEach(p=>{p.answered=false;p.lastAnswer=null;});
  broadcast(room); io.to(room.code).emit('round_started',{round:room.round,totalRounds:room.totalRounds,question:room.question,category:room.category});
}
function finishRound(room){
  room.phase='results';
  const scores=Object.fromEntries([...room.players.values()].map(p=>[p.id,p.score]));
  const answers=Object.fromEntries([...room.players.values()].map(p=>[p.id,p.lastAnswer]));
  broadcast(room); io.to(room.code).emit('round_results',{round:room.round,scores,answers});
}
function finishGame(room){
  room.phase='finished'; room.gamesPlayed++; room.sharedPoints += [...room.players.values()].reduce((a,p)=>a+p.score,0);
  const k=dayKey();
  if(room.lastCompletedDay!==k){
    const y=new Date(Date.now()-86400000).toISOString().slice(0,10);
    room.streak = room.lastCompletedDay===y ? room.streak+1 : 1;
    room.bestStreak=Math.max(room.bestStreak,room.streak); room.lastCompletedDay=k;
  }
  const players=[...room.players.values()];
  const winner=players.slice().sort((a,b)=>b.score-a.score)[0];
  players.forEach(p=>{ if(!p.accountId)return; const u=sharedData.users[p.accountId]||upsertUser(p.accountId,{name:p.name,avatar:p.avatar}); u.stats=u.stats||{games:0,wins:0,losses:0,points:0,bestStreak:0}; u.stats.games++; u.stats.points+=(p.score||0); if(p===winner)u.stats.wins++; else u.stats.losses++; u.stats.bestStreak=Math.max(u.stats.bestStreak,p.personalStreak||0); u.xp=(u.xp||0)+(p.score||0); p.xp=u.xp; p.level=levelFromXp(u.xp); });
  room.lastWinner=winner?.id||null;
  saveData(); broadcast(room);
  io.to(room.code).emit('game_finished',{winnerId:room.lastWinner,stats:roomStats(room),players:players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score}))});
}
function loadShared(room){
  const d=sharedData[room.code]; if(!d)return;
  Object.assign(room,{gamesPlayed:d.gamesPlayed||0,sharedPoints:d.sharedPoints||0,streak:d.streak||0,bestStreak:d.bestStreak||0,lastCompletedDay:d.lastCompletedDay||null});
}
function saveRoom(room){
  sharedData[room.code]={gamesPlayed:room.gamesPlayed,sharedPoints:room.sharedPoints,streak:room.streak,bestStreak:room.bestStreak,lastCompletedDay:room.lastCompletedDay}; saveData();
}

io.on('connection',socket=>{
  socket.on('resume_session',session=>{
    ensureConnections(); const rec=sharedData.connections?.[clean(session,80)]; if(!rec)return socket.emit('resume_failed');
    let room=rooms.get(rec.code);
    if(!room){ room={code:rec.code,players:new Map(),sessions:new Map(),phase:'lobby',round:0,totalRounds:5,category:'Would You Rather',question:'',music:'romantic',chatEnabled:true,chat:[],gameMode:'Classic',dateNight:null,createdAt:Date.now(),gamesPlayed:0,sharedPoints:0,streak:0,bestStreak:0,lastCompletedDay:null,lastWinner:null}; loadShared(room); rooms.set(room.code,room); }
    if(room.players.size>=2)return socket.emit('resume_failed');
    const old=room.sessions.get(session)||{}; const accountId=accountIdForSession(session)||old.accountId||null; const u=accountId?sharedData.users[accountId]:null; const player={...old,id:socket.id,session,accountId,name:u?.name||rec.name||old.name||'Player',avatar:u?.avatar||rec.avatar||old.avatar||'🌙',playerTag:u?.playerTag||old.playerTag||null,level:u?levelFromXp(u.xp):1,xp:u?.xp||0,ready:false,score:0,personalStreak:0,answered:false,lastAnswer:null,lastChat:0};
    room.players.set(socket.id,player); room.sessions.set(session,player); socket.join(room.code); socket.data.room=room.code; socket.data.session=session;
    socket.emit('resumed',{code:room.code,session}); socket.emit('chat_history',room.chat); broadcast(room);
  });
  socket.on('create_room',payload=>{
    let code; do{code=makeCode();}while(rooms.has(code));
    const room={code,players:new Map(),sessions:new Map(),phase:'lobby',round:0,totalRounds:5,category:'Would You Rather',question:'',music:'romantic',chatEnabled:true,chat:[],gameMode:'Classic',dateNight:null,createdAt:Date.now(),gamesPlayed:0,sharedPoints:0,streak:0,bestStreak:0,lastCompletedDay:null,lastWinner:null};
    loadShared(room);
    const session=clean(payload?.session,80)||token(); const accountId=accountIdForSession(payload?.authSession||''); const u=accountId?upsertUser(accountId,{name:payload?.name,avatar:payload?.avatar}):null; const player={id:socket.id,session,accountId,name:u?.name||clean(payload?.name,20)||'Player',avatar:u?.avatar||safeAvatar(payload?.avatar),playerTag:u?.playerTag||null,level:u?levelFromXp(u.xp):1,xp:u?.xp||0,ready:false,score:0,personalStreak:0,answered:false,lastAnswer:null,lastChat:0};
    room.players.set(socket.id,player); rooms.set(code,room); room.sessions.set(session,player); sharedData.connections[session]={code,name:player.name,avatar:player.avatar,accountId:player.accountId||null}; saveData(); socket.join(code); socket.data.room=code; socket.data.session=session;
    socket.emit('room_created',{code,session}); socket.emit('chat_history',room.chat); broadcast(room);
  });

  socket.on('join_room',payload=>{
    const code=clean(payload?.code,10).toUpperCase(),room=rooms.get(code);
    if(!room)return socket.emit('error_message','Room not found.');
    if(room.players.size>=2)return socket.emit('error_message','This private room already has two players.');
    if(room.phase!=='lobby')return socket.emit('error_message','The game has already started.');
    const session=clean(payload?.session,80)||token(); const accountId=accountIdForSession(payload?.authSession||''); const u=accountId?upsertUser(accountId,{name:payload?.name,avatar:payload?.avatar}):null; const player={id:socket.id,session,accountId,name:u?.name||clean(payload?.name,20)||'Player',avatar:u?.avatar||safeAvatar(payload?.avatar),playerTag:u?.playerTag||null,level:u?levelFromXp(u.xp):1,xp:u?.xp||0,ready:false,score:0,personalStreak:0,answered:false,lastAnswer:null,lastChat:0};
    room.players.set(socket.id,player); room.sessions.set(session,player); sharedData.connections[session]={code,name:player.name,avatar:player.avatar,accountId:player.accountId||null}; saveData(); socket.join(code); socket.data.room=code; socket.data.session=session;
    socket.emit('joined_room',{code,session}); socket.emit('chat_history',room.chat); systemChat(room,`${player.name} joined the room.`); broadcast(room);
  });

  socket.on('update_profile',payload=>{
    const room=getRoom(socket),p=getPlayer(room,socket); if(!room||!p)return;
    p.name=clean(payload?.name,20)||p.name; p.avatar=safeAvatar(payload?.avatar);
    if(p.accountId){ const u=upsertUser(p.accountId,{name:p.name,avatar:p.avatar}); p.playerTag=u.playerTag; p.xp=u.xp; p.level=levelFromXp(u.xp); }
    ensureConnections(); if(p.session) sharedData.connections[p.session]={code:room.code,name:p.name,avatar:p.avatar,accountId:p.accountId||null}; saveData(); broadcast(room);
    systemChat(room,`${p.name} updated their profile.`);
  });
  socket.on('set_ready',ready=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||room.phase!=='lobby')return;p.ready=!!ready;broadcast(room);});
  socket.on('set_rounds',n=>{const room=getRoom(socket);if(!room||room.phase!=='lobby')return;room.totalRounds=Math.max(3,Math.min(10,Number(n)||5));broadcast(room);});
  socket.on('set_category',cat=>{const room=getRoom(socket);if(!room||room.phase!=='lobby'||!QUESTIONS[cat])return;room.category=cat;broadcast(room);});
  socket.on('set_music',music=>{const room=getRoom(socket);if(!room||!['romantic','phonk','off'].includes(music))return;room.music=music;broadcast(room);});
  socket.on('set_mode',mode=>{const room=getRoom(socket);if(!room||room.phase!=='lobby'||!['Classic','Chaos','Quick Play'].includes(mode))return;room.gameMode=mode;if(mode==='Quick Play')room.totalRounds=Math.min(room.totalRounds,3);broadcast(room);});
  socket.on('set_chat_enabled',enabled=>{const room=getRoom(socket);if(!room)return;room.chatEnabled=!!enabled;broadcast(room);systemChat(room,room.chatEnabled?'Chat enabled.':'Chat disabled.');});

  socket.on('start_game',()=>{const room=getRoom(socket);if(!room)return;if(room.players.size!==2)return socket.emit('error_message','Both players need to join first.');room.round=0;room.dateNight=null;room.players.forEach(p=>{p.score=0;p.personalStreak=0;});startRound(room);});
  socket.on('submit_answer',answer=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||room.phase!=='game'||p.answered)return;if(room.gameMode==='Chaos'&&Math.random()<0.18){p.personalStreak=0;socket.emit('answer_saved',{points:0,bonus:'Chaos twist — no points this time.'});}else{p.personalStreak++;const points=10+(p.personalStreak-1)*5;p.score+=points;socket.emit('answer_saved',{points,streak:p.personalStreak});}p.lastAnswer=clean(answer,100);p.answered=true;broadcast(room);if([...room.players.values()].every(x=>x.answered))finishRound(room);});
  socket.on('next_round',()=>{const room=getRoom(socket);if(!room||room.phase!=='results')return;if(room.round>=room.totalRounds){finishGame(room);return;}startRound(room);});
  socket.on('rematch',()=>{const room=getRoom(socket);if(!room)return;room.phase='lobby';room.round=0;room.question='';room.dateNight=null;room.players.forEach(p=>{p.ready=false;p.score=0;p.personalStreak=0;p.answered=false;p.lastAnswer=null;});broadcast(room);systemChat(room,'Rematch ready — both players can ready up again.');});
  socket.on('date_night',()=>{const room=getRoom(socket);if(!room)return;room.dateNight=DATE_NIGHTS[Math.floor(Math.random()*DATE_NIGHTS.length)];broadcast(room);systemChat(room,`Date Night pick: ${room.dateNight.title}`);io.to(room.code).emit('date_night_pick',room.dateNight);});
  socket.on('chat',text=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||!room.chatEnabled)return;const message=clean(text,300);if(!message)return;const now=Date.now();if(now-p.lastChat<700)return;p.lastChat=now;const msg={id:socket.id,accountId:p.accountId||null,playerTag:p.playerTag||null,name:p.name,avatar:p.avatar,text:message,time:now};room.chat.push(msg);if(room.chat.length>150)room.chat.shift();io.to(room.code).emit('chat',msg);io.to(room.code).emit('typing',null);});
  socket.on('typing',isTyping=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||!room.chatEnabled)return;socket.to(room.code).emit('typing',isTyping?p.name:null);});
  socket.on('disconnect',()=>{const room=getRoom(socket);if(!room)return;const p=room.players.get(socket.id);room.players.delete(socket.id);if(p)systemChat(room,`${p.name} left the room.`);if(p?.session) room.sessions.set(p.session,{...p,id:null}); saveRoom(room); if(room.players.size>0){room.phase='lobby';room.round=0;room.question='';room.players.forEach(x=>{x.ready=false;x.score=0;x.personalStreak=0;x.answered=false;});broadcast(room);} else { room.phase='lobby'; room.round=0; saveData(); }});
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Game Night running on port ${PORT}`));
