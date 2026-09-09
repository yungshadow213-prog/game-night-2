```javascript
const socket = io();
let state = null;
let ready = false;
let selectedAvatar = localStorage.getItem('gn_avatar') || '🌙';
const AVATARS = ['🌙', '✨', '🦋', '🐈', '🐼', '🦊', '🐰', '🐻', '🐱', '🌸', '⭐', '🍓', '🎀', '🩷', '🖤', '🌌'];

const $ = id => document.getElementById(id);

// UI Utility Functions
function toast(message) {
    const toastElement = $('toast');
    toastElement.textContent = message;
    toastElement.style.display = 'block';
    clearTimeout(window.__toast);
    window.__toast = setTimeout(() => toastElement.style.display = 'none', 2200);
}

function show(id) {
    $(id).classList.remove('hidden');
}

function hide(id) {
    $(id).classList.add('hidden');
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Profile and Room Management
function getProfile() {
    return { name: localStorage.getItem('gn_name') || '', avatar: selectedAvatar };
}

function createRoom() {
    const p = getProfile();
    const name = $('name').value.trim() || p.name;
    if (!name) return toast('Enter your name first.');
    localStorage.setItem('gn_name', name);
    socket.emit('create_room', { name, avatar: selectedAvatar });
}

function joinRoom() {
    const p = getProfile();
    const name = $('name').value.trim() || p.name;
    const code = $('code').value.trim();
    if (!name || !code) return toast('Enter your name and room code.');
    localStorage.setItem('gn_name', name);
    socket.emit('join_room', { name, code, avatar: selectedAvatar });
}

function enterApp() {
    $('home').style.display = 'none';
    $('app').style.display = 'block';
    renderAvatarPicker();
    $('profileName').value = localStorage.getItem('gn_name') || '';
}

// Socket Event Listeners
socket.on('room_created', ({ code }) => {
    toast(`Room created: ${code}`);
    enterApp();
});
socket.on('joined_room', ({ code }) => {
    toast(`Joined room ${code}`);
    enterApp();
});
socket.on('error_message', toast);
socket.on('state', s => {
    state = s;
    renderState();
});
socket.on('chat_history', arr => {
    arr.forEach(renderChat);
    syncChats();
});
socket.on('chat', message => {
    renderChat(message);
    syncChats();
});
socket.on('round_started', data => {
    show('game');
    hide('lobby');
    hide('results');
    hide('finished');
    $('round').textContent = data.round;
    $('total').textContent = data.totalRounds;
    $('question').textContent = data.question;
    $('categoryLabel').textContent = data.category;
    $('answerStatus').textContent = 'Pick an answer. Your streak bonus builds your score.';
    playCue('start');
});
socket.on('answer_saved', data => {
    $('answerStatus').textContent = data.points ? `Answer saved • +${data.points} points • streak ${data.streak}` : (data.bonus || 'Answer saved');
    toast(data.points ? `+${data.points} ❤️` : 'Chaos twist');
    playCue(data.points ? 'good' : 'warn');
});
socket.on('round_results', data => {
    show('results');
    hide('game');
    $('resultRound').textContent = data.round;
    const myId = socket.id;
    const myScore = data.scores[myId] ?? 0;
    const otherId = Object.keys(data.scores).find(x => x !== myId);
    $('myScore').textContent = myScore;
    $('theirScore').textContent = otherId ? data.scores[otherId] : 0;
    const me = state?.players.find(p => p.id === myId);
    $('resultStreak').textContent = me?.personalStreak || 0;
    playCue('result');
});
socket.on('game_finished', data => {
    show('finished');
    hide('game');
    hide('results');
    hide('lobby');
    $('winnerText').textContent = data.winnerId === socket.id ? 'You won this one 🏆' : 'A close one — rematch? 💕';
    $('finalStreak').textContent = data.stats.streak;
    $('finalBest').textContent = data.stats.bestStreak;
    $('finalGames').textContent = data.stats.games;
    $('finalPoints').textContent = data.stats.sharedPoints;
    playCue('win');
});
socket.on('date_night_pick', showDateNight);

// Render Functions
function renderState() {
    if (!state) return;
    $('roomPill').textContent = `ROOM ${state.code}`;
    $('streakPill').textContent = `🔥 Streak ${state.stats.streak}`;
    $('music').value = state.music;
    $('musicPill').textContent = state.music === 'phonk' ? '🖤 Phonk' : state.music === 'off' ? '🔇 Off' : '🎵 Romantic';
    $('rounds').value = state.totalRounds;
    $('mode').value = state.gameMode;
    $('category').value = state.category;
    $('chatEnabled').value = state.chatEnabled ? 'on' : 'off';
    renderPlayers();
    renderProfileStats();
    if (state.dateNight) showDateNight(state.dateNight);
    if (state.phase === 'lobby') {
        show('lobby');
        hide('game');
        hide('results');
        hide('finished');
    }
    if (state.phase === 'finished') {
        show('finished');
        hide('lobby');
        hide('game');
        hide('results');
    }
}

function renderPlayers() {
    $('players').innerHTML = state.players.map(p => `
        <div class="player">
            <div class="avatar">${esc(p.avatar)}</div>
            <div class="score">${p.score} pts</div>
            <div class="name">${esc(p.name)}</div>
            <div class="${p.ready ? 'ready' : 'tiny'}">${p.ready ? '✓ Ready' : 'Not ready'}</div>
            <div class="tiny">🔥 ${p.personalStreak} streak</div>
        </div>
    `).join('');
    const me = state.players.find(x => x.id === socket.id);
    ready = !!me?.ready;
    $('readyBtn').textContent = ready ? "I'm Not Ready" : "I'm Ready";
}

function renderChat(message) {
    const el = document.createElement('div');
    if (message.system) {
        el.className = 'msg system';
        el.textContent = message.text;
    } else {
        el.className = `msg ${message.id === socket.id ? 'mine' : ''}`;
        el.innerHTML = `<b>${esc(message.avatar || '')} ${esc(message.name)}</b><div class="bubble">${esc(message.text)}</div>`;
    }
    $('messages').appendChild(el);
    $('messages').scrollTop = $('messages').scrollHeight;
}

function syncChats() {
    $('messagesGame').innerHTML = $('messages').innerHTML;
    $('messagesGame').scrollTop = $('messagesGame').scrollHeight;
}

function renderAvatarPicker() {
    $('avatarPicker').innerHTML = AVATARS.map(a => `
        <button class="ava ${a === selectedAvatar ? 'active' : ''}" onclick="selectAvatar('${a}')">${a}</button>
    `).join('');
    $('profileBig').textContent = selectedAvatar;
}

function renderProfileStats() {
    const me = state.players.find(p => p.id === socket.id);
    $('pPoints').textContent = me?.score || 0;
    $('pGames').textContent = state.stats.games;
}

function showDateNight(data) {
    $('dateNight').innerHTML = `<h3>🌙 ${esc(data.title)}</h3><p>${esc(data.desc)}</p>`;
    show('dateNight');
    if (!$('finished').classList.contains('hidden')) {
        $('dateNightFinal').innerHTML = `<h3>🌙 ${esc(data.title)}</h3><p>${esc(data.desc)}</p>`;
        show('dateNightFinal');
    }
}

// User Actions
function toggleReady() {
    ready = !ready;
    socket.emit('set_ready', ready);
}

function startGame() {
    socket.emit('start_game');
}

function setRounds(value) {
    socket.emit('set_rounds', Number(value));
}

function setCategory(value) {
    socket.emit('set_category', value);
}

function setMode(value) {
    socket.emit('set_mode', value);
}

function setMusic(value) {
    socket.emit('set_music', value);
    playCue(value === 'phonk' ? 'phonk' : 'soft');
}

function setChatEnabled(value) {
    socket.emit('set_chat_enabled', value);
}

function answer(value) {
    socket.emit('submit_answer', value);
}

function nextRound() {
    socket.emit('next_round');
}

function rematch() {
    socket.emit('rematch');
}

function sendChat(which) {
    const input = which === 'game' ? $('chatInputGame') : $('chatInput');
    if (input.value.trim()) {
        socket.emit('chat', input.value.trim());
        input.value = '';
    }
}

function selectAvatar(avatar) {
    selectedAvatar = avatar;
    renderAvatarPicker();
}

function saveProfile() {
    const name = $('profileName').value.trim();
    if (!name) return toast('Add a display name.');
    localStorage.setItem('gn_name', name);
    localStorage.setItem('gn_avatar', selectedAvatar);
    socket.emit('update_profile', { name, avatar: selectedAvatar });
    toast('Profile updated ✨');
}

function randomDateNight() {
    socket.emit('date_night');
}

// Event Listeners for Chat Inputs
['chatInput', 'chatInputGame'].forEach(id =>
    $(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') sendChat(id === 'chatInputGame' ? 'game' : 'lobby');
    })
);

// Audio
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playCue(type) {
    const c = getAudioContext();
    if (!c) return;

    const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();

    const freqMap = { start: 440, good: 660, result: 330, win: 880, soft: 220, phonk: 120, warn: 180 };
    const freq = freqMap[type] || 300;

    o.type = type === 'phonk' ? 'sawtooth' : 'sine';
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(freq * 1.18, now + 0.22);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.045, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    o.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + 0.45);
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}
```
