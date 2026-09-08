const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const DATA_FILE = path.join(__dirname, 'gamenight-data.json');
let sharedData = {};
try { sharedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { sharedData = {}; }
function saveData(){ try { fs.writeFileSync(DATA_FILE, JSON.stringify(sharedData, null, 2)); } catch {} }
function token(){ return require('crypto').randomBytes(18).toString('hex'); }
function ensureConnections(){ if(!sharedData.connections) sharedData.connections={}; }
ensureConnections();

const AVATARS = ['🌙','✨','🦋','🐈','🐼','🦊','🐰','🐻','🐱','🌸','⭐','🍓','🎀','🩷','🖤','🌌'];
const QUESTIONS = {
  "Would You Rather": [
    "Would you rather plan a cozy night or let the other person surprise you?",
    "Would you rather get a sweet message or a funny voice note?",
    "Would you rather match profile pictures or wallpapers?",
    "Would you rather be teased playfully or complimented dramatically?",
    "Would you rather have a spontaneous adventure or a calm late-night chat?",
    "Bold pick: would you rather answer a super-honest harmless question or do a silly challenge?",
    "Who would you rather choose for a team: the person who makes you laugh or the person who keeps you calm?",
    "What kind of compliment would make you smile instantly?",
    "Would you rather recreate your funniest shared moment or make a brand-new one?",
    "What is one tiny thing the other person does that is ridiculously cute?",
    "Would you rather exchange favorite memories or future date ideas?",
    "Teasing round: who is more likely to say “I wasn’t being dramatic” after being dramatic?"
  ],
  "How Well Do You Know Me?": [
    "What kind of message instantly improves my mood?",
    "What would my perfect chill evening look like?",
    "What harmless thing am I most likely to get competitive about?",
    "What compliment would I probably remember for a long time?",
    "What is one cute habit you think I have?",
    "Bold round: what playful tease would make me laugh instead of annoy me?",
    "What kind of date-night activity would I choose first?",
    "What is something I would probably choose over going to bed?",
    "What is one thing I secretly enjoy being noticed for?",
    "What kind of encouragement works best on me?",
    "What memory do you think I would replay forever?",
    "Teasing round: what phrase do I probably say way too much?"
  ],
  "Guess My Answer": [
    "What would I pick for a perfect evening together?",
    "Which kind of compliment would I choose: funny, sweet, or dramatic?",
    "Would I rather talk for hours or play games for hours?",
    "What snack would I pick for movie night?",
    "What would I choose for our next online date?",
    "Bold round: which harmless challenge would I actually agree to?",
    "What would make me laugh fastest?",
    "Which vibe fits me tonight: cozy, chaotic, playful, or dreamy?",
    "What kind of surprise would I appreciate most?",
    "Would I pick a long conversation or a spontaneous game first?",
    "What would I probably choose as our shared wallpaper theme?",
    "Teasing round: what silly thing would I pretend not to care about?"
  ],
  "Couple Quiz": [
    "Who is more likely to start a random conversation?",
    "Who is more likely to remember a tiny detail?",
    "Who is more likely to turn a simple game into a competition?",
    "Who is more likely to send a sweet message first?",
    "Who is more likely to make the other laugh when they are quiet?",
    "Bold round: who is more likely to accept a silly challenge immediately?",
    "Who is more likely to plan a surprise?",
    "Who is more likely to say “one more round” five times?",
    "Who is more likely to notice a mood change first?",
    "Who is more likely to give a dramatic compliment?",
    "Who is more likely to save a funny message?",
    "Teasing round: who is more likely to pretend they are not jealous of losing a game?"
  ],
  "Truth or Dare — Lite": [
    "Truth: What is one wholesome thing you genuinely appreciate about the other player?",
    "Truth: What funny memory always makes you smile?",
    "Dare: Give the other player a ridiculous nickname for one round.",
    "Dare: Send your most dramatic emoji reaction.",
    "Truth: What tiny thing always cheers you up?",
    "Dare: Give the other player a three-word compliment.",
    "Truth: What is one harmless thing you would love to do together someday?",
    "Dare: Describe your ideal date night using only five emojis.",
    "Truth: What is one quality you really value in a close friend?",
    "Dare: Create a funny team name for both of you.",
    "Truth: What is the nicest surprise someone could plan for you?",
    "Dare: Deliver your best fake awards-show speech about your teammate."
  ],
  "Flirty / Teasing": [
    "Who gets shy first when the conversation gets extra sweet?",
    "What harmless thing does the other player do that you find adorable?",
    "Who is more likely to start a playful argument just to keep talking?",
    "What compliment would make you smile all day?",
    "Who is more likely to send a random “thinking of you” message?",
    "Bold but wholesome: what playful question would you be brave enough to ask?",
    "What is your favorite kind of friendly attention?",
    "Who is more likely to give an over-the-top compliment?",
    "What cute habit would you never want the other player to lose?",
    "If your duo had a romantic-comedy title, what would it be?",
    "What kind of wholesome surprise would feel especially sweet?",
    "Teasing round: who is more likely to deny being the more dramatic one?"
  ],
  "Drawing Duel": [
    "Draw the other player as a superhero.",
    "Draw your duo as a cute cartoon.",
    "Draw your dream hangout in five minutes.",
    "Draw the funniest version of the other player.",
    "Draw a symbol that represents your friendship.",
    "Bold round: draw the most dramatic compliment you can imagine.",
    "Draw a tiny scene that would make the other player smile.",
    "Draw your shared gaming setup of the future.",
    "Draw a silly mascot for your duo.",
    "Draw a wholesome romantic-comedy poster for your duo.",
    "Draw the other player as a game character.",
    "Teasing round: draw who is more dramatic without using words."
  ],
  "Music Swap": [
    "Pick a song vibe that matches your mood and explain why.",
    "Choose a song that would make the other player laugh.",
    "Pick a calm track for a late-night chat.",
    "Choose a song that feels like a victory theme for your duo.",
    "Pick a song vibe that reminds you of a favorite memory.",
    "Bold but wholesome: choose a song title that would be a funny nickname for your duo.",
    "Pick a song that sounds like a playful challenge.",
    "Choose a song for a future date-night playlist.",
    "Pick a song that feels warm and comforting.",
    "Choose a song that matches your funniest shared moment.",
    "Pick a song that would fit a romantic-comedy scene.",
    "Teasing round: pick a song that describes who is more dramatic."
  ],
  "Watch Together": [
    "What genre would you choose for a cozy watch night?",
    "Who gets to pick the first episode?",
    "What kind of scene usually makes you laugh?",
    "What rating would you give your duo as a watch-party team?",
    "Would you pause to discuss or save reactions for the end?",
    "Bold but wholesome: choose a ridiculous movie challenge for the night.",
    "What snack would you bring to the virtual watch party?",
    "Who is more likely to predict the ending?",
    "What genre would surprise you if the other player picked it?",
    "What would your watch-party title be?",
    "What kind of wholesome movie moment would make you both smile?",
    "Teasing round: who would complain about spoilers first?"
  ],
  "Two Truths & A Lie": [
    "Share three harmless facts and let the other player guess the lie.",
    "Which fact about you would be hardest to believe?",
    "What funny habit could you use as one of your truths?",
    "What childhood hobby could become a truth?",
    "What unexpected food opinion could become a truth?",
    "Bold but wholesome: make one truth hilariously embarrassing but harmless.",
    "What random talent could you claim as a truth?",
    "What tiny achievement would make a good truth?",
    "What fictional skill would you love to have?",
    "What silly prediction about yourself could be a truth?",
    "What wholesome compliment could hide inside one of your truths?",
    "Teasing round: which player is more likely to make the lie too obvious?"
  ],
  "Reaction Race": [
    "Pick the best reaction to receiving a surprise compliment.",
    "Pick the reaction to losing by one point.",
    "Pick the reaction to a hilarious plot twist.",
    "Pick the reaction to a surprise date-night plan.",
    "Pick the reaction to being called the MVP.",
    "Bold but wholesome: pick the reaction to a dramatic but friendly tease.",
    "Pick the reaction to an unexpected win.",
    "Pick the reaction to a cute avatar change.",
    "Pick the reaction to a midnight “you awake?” message.",
    "Pick the reaction to a perfect game-night streak.",
    "Pick the reaction to a wholesome surprise.",
    "Teasing round: pick the reaction to being called the dramatic one."
  ],
  "Guess The Vibe": [
    "Guess whether the other player wants cozy, chaotic, playful, or dreamy.",
    "Guess which vibe fits their favorite game.",
    "Guess their ideal movie-night mood.",
    "Guess their reaction to a compliment.",
    "Guess whether they prefer a planned or spontaneous date night.",
    "Bold but wholesome: guess which harmless challenge they would choose.",
    "Guess their favorite kind of chat.",
    "Guess their ideal music mood.",
    "Guess what would make them laugh today.",
    "Guess which color fits their current vibe.",
    "Guess their perfect shared activity.",
    "Teasing round: guess who is secretly more competitive."
  ],
  "Card Flip": [
    "Choose a card: compliment, memory, question, or challenge.",
    "Choose a card: funny, sweet, chaotic, or cozy.",
    "Choose a card for a surprise mini challenge.",
    "Choose a card for a shared memory prompt.",
    "Choose a card for a playful question.",
    "Bold but wholesome: choose the card with the bravest harmless prompt.",
    "Choose a card for a team challenge.",
    "Choose a card for a dramatic compliment.",
    "Choose a card for a future date idea.",
    "Choose a card for a silly confession.",
    "Choose a card for a warm appreciation prompt.",
    "Teasing round: choose who gets the “most dramatic” card."
  ],
  "Mini Tournament": [
    "Round 1: pick the player most likely to win a trivia sprint.",
    "Round 2: pick the player most likely to win a reaction challenge.",
    "Round 3: pick the player most likely to plan the better date night.",
    "Round 4: pick the player most likely to remember details.",
    "Round 5: pick the player most likely to make the other laugh.",
    "Bold but wholesome: pick the player most likely to accept a silly challenge.",
    "Pick the player most likely to become MVP.",
    "Pick the player most likely to choose the best music.",
    "Pick the player most likely to win a drawing duel.",
    "Pick the player most likely to give the better compliment.",
    "Pick the player most likely to keep the streak alive.",
    "Teasing round: pick the player most likely to demand a rematch."
  ],
  "Night Roulette": [
    "Tonight’s random choice: cozy chat or quick game?",
    "Tonight’s random choice: music or movie?",
    "Tonight’s random choice: compliment or challenge?",
    "Tonight’s random choice: memory or future plan?",
    "Tonight’s random choice: calm or chaotic?",
    "Bold but wholesome: tonight’s choice is a harmless daring question or a silly dare.",
    "Tonight’s random choice: drawing or trivia?",
    "Tonight’s random choice: sweet message or funny message?",
    "Tonight’s random choice: playlist or watch party?",
    "Tonight’s random choice: old memory or new idea?",
    "Tonight’s random choice: romantic-comedy vibe or adventure vibe?",
    "Teasing round: tonight’s choice is “who is more dramatic?”"
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
    players:[...room.players.values()].map(p=>({id:p.id,name:p.name,avatar:p.avatar,ready:p.ready,score:p.score,personalStreak:p.personalStreak,answered:p.answered})),
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
    const old=room.sessions.get(session)||{}; const player={...old,id:socket.id,session,name:rec.name||old.name||'Player',avatar:rec.avatar||old.avatar||'🌙',ready:false,score:0,personalStreak:0,answered:false,lastAnswer:null,lastChat:0};
    room.players.set(socket.id,player); room.sessions.set(session,player); socket.join(room.code); socket.data.room=room.code; socket.data.session=session;
    socket.emit('resumed',{code:room.code,session}); socket.emit('chat_history',room.chat); broadcast(room);
  });
  socket.on('create_room',payload=>{
    let code; do{code=makeCode();}while(rooms.has(code));
    const room={code,players:new Map(),sessions:new Map(),phase:'lobby',round:0,totalRounds:5,category:'Would You Rather',question:'',music:'romantic',chatEnabled:true,chat:[],gameMode:'Classic',dateNight:null,createdAt:Date.now(),gamesPlayed:0,sharedPoints:0,streak:0,bestStreak:0,lastCompletedDay:null,lastWinner:null};
    loadShared(room);
    const session=token(); const player={id:socket.id,session,name:clean(payload?.name,20)||'Player',avatar:safeAvatar(payload?.avatar),ready:false,score:0,personalStreak:0,answered:false,lastAnswer:null,lastChat:0};
    room.players.set(socket.id,player); rooms.set(code,room); room.sessions.set(session,player); sharedData.connections[session]={code,name:player.name,avatar:player.avatar}; saveData(); socket.join(code); socket.data.room=code; socket.data.session=session;
    socket.emit('room_created',{code,session}); socket.emit('chat_history',room.chat); broadcast(room);
  });

  socket.on('join_room',payload=>{
    const code=clean(payload?.code,10).toUpperCase(),room=rooms.get(code);
    if(!room)return socket.emit('error_message','Room not found.');
    if(room.players.size>=2)return socket.emit('error_message','This private room already has two players.');
    if(room.phase!=='lobby')return socket.emit('error_message','The game has already started.');
    const session=clean(payload?.session,80)||token(); const player={id:socket.id,session,name:clean(payload?.name,20)||'Player',avatar:safeAvatar(payload?.avatar),ready:false,score:0,personalStreak:0,answered:false,lastAnswer:null,lastChat:0};
    room.players.set(socket.id,player); room.sessions.set(session,player); sharedData.connections[session]={code,name:player.name,avatar:player.avatar}; saveData(); socket.join(code); socket.data.room=code; socket.data.session=session;
    socket.emit('joined_room',{code,session}); socket.emit('chat_history',room.chat); systemChat(room,`${player.name} joined the room.`); broadcast(room);
  });

  socket.on('update_profile',payload=>{
    const room=getRoom(socket),p=getPlayer(room,socket); if(!room||!p)return;
    p.name=clean(payload?.name,20)||p.name; p.avatar=safeAvatar(payload?.avatar); ensureConnections(); if(p.session) sharedData.connections[p.session]={code:room.code,name:p.name,avatar:p.avatar}; saveData(); broadcast(room);
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
  socket.on('chat',text=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||!room.chatEnabled)return;const message=clean(text,300);if(!message)return;const now=Date.now();if(now-p.lastChat<700)return;p.lastChat=now;const msg={id:socket.id,name:p.name,avatar:p.avatar,text:message,time:now};room.chat.push(msg);if(room.chat.length>150)room.chat.shift();io.to(room.code).emit('chat',msg);io.to(room.code).emit('typing',null);});
  socket.on('typing',isTyping=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||!room.chatEnabled)return;socket.to(room.code).emit('typing',isTyping?p.name:null);});
  socket.on('disconnect',()=>{const room=getRoom(socket);if(!room)return;const p=room.players.get(socket.id);room.players.delete(socket.id);if(p)systemChat(room,`${p.name} left the room.`);if(p?.session) room.sessions.set(p.session,{...p,id:null}); saveRoom(room); if(room.players.size>0){room.phase='lobby';room.round=0;room.question='';room.players.forEach(x=>{x.ready=false;x.score=0;x.personalStreak=0;x.answered=false;});broadcast(room);} else { room.phase='lobby'; room.round=0; saveData(); }});
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Game Night running on port ${PORT}`));
