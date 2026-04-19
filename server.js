const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Allow longer disconnect before cleanup — gives time to reconnect
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/sec', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin.html', (req, res) => res.redirect('/'));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

// ── Game State ────────────────────────────────────────────────────────────────
const rooms = {};
// rooms[code] = {
//   adminName, adminSocketId,
//   players: { [name]: { socketId, card, filledSet, done } },
//   confirmCounts: { [confirmerName]: { [requesterName]: count } },
//   winner: null
// }

const pending = {};
// pending[key] = { requesterName, confirmerName, roomCode, index }

const CONFIRM_LIMIT = 2; // max times Y can confirm for X

const ACTIVITIES = [
  { id: 0,  text: "Lived outside Tunisia" },
  { id: 1,  text: "Plays a musical instrument" },
  { id: 2,  text: "Written code at 3am" },
  { id: 3,  text: "Addicted to coffee or energy drinks" },
  { id: 4,  text: "Read 3 or more books this year" },
  { id: 5,  text: "Solved a CTF challenge" },
  { id: 6,  text: "Knows how to cook a full meal" },
  { id: 7,  text: "Had an all-nighter gaming session" },
  { id: 8,  text: "Daily drives Linux" },
  { id: 9,  text: "Draws, paints or designs" },
  { id: 10, text: "Exercises at least twice a week" },
  { id: 11, text: "Built or tinkered with hardware" },
  { id: 12, text: "Speaks 3 or more languages" },
  { id: 13, text: "Performed on stage" },
  { id: 14, text: "Has gone rock climbing or hiking" },
  { id: 15, text: "Dreams of working abroad in tech" },
  { id: 16, text: "Can do a magic trick" },
  { id: 17, text: "Knows how to swim" },
  { id: 18, text: "Plays chess regularly" },
  { id: 19, text: "Photography as a hobby" },
  { id: 20, text: "Won a hackathon or competition" },
  { id: 21, text: "Sleeps after 2am regularly" },
  { id: 22, text: "Has a startup idea written down" },
  { id: 23, text: "Met someone from another university today" },
  { id: 24, text: "FREE SPACE" },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateCard() {
  const pool = ACTIVITIES.filter(a => a.id !== 24);
  const picked = shuffle(pool).slice(0, 24);
  picked.splice(12, 0, ACTIVITIES[24]);
  return picked;
}

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function getRoomLeaderboard(room) {
  return Object.entries(room.players)
    .map(([name, p]) => ({ name, filled: p.filledSet.size, total: 25, done: p.done }))
    .sort((a, b) => b.filled - a.filled);
}

// How many times confirmerName has confirmed for requesterName in this room
function getConfirmCount(room, confirmerName, requesterName) {
  return (room.confirmCounts[confirmerName]?.[requesterName]) || 0;
}

function incrementConfirmCount(room, confirmerName, requesterName) {
  if (!room.confirmCounts[confirmerName]) room.confirmCounts[confirmerName] = {};
  room.confirmCounts[confirmerName][requesterName] = getConfirmCount(room, confirmerName, requesterName) + 1;
}

// ── Socket Events ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  // ── Admin: create room ──────────────────────────────────────────────────────
  socket.on('create_room', ({ adminName }, cb) => {
    const code = generateRoomCode();
    rooms[code] = {
      adminName,
      adminSocketId: socket.id,
      players: {},
      confirmCounts: {},
      winner: null,
    };
    socket.join(code);
    socket.data.room = code;
    socket.data.name = adminName;
    socket.data.isAdmin = true;
    cb({ code });
  });

  // ── Admin: reconnect after refresh ─────────────────────────────────────────
  socket.on('admin_reconnect', ({ code, adminName }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ error: 'Room no longer exists.' });
    if (room.adminName !== adminName) return cb({ error: 'Not authorized.' });

    room.adminSocketId = socket.id;
    socket.join(code);
    socket.data.room = code;
    socket.data.name = adminName;
    socket.data.isAdmin = true;

    cb({
      ok: true,
      code,
      leaderboard: getRoomLeaderboard(room),
      playerCount: Object.keys(room.players).length,
      winner: room.winner,
    });
  });

  // ── Player: join ───────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, name }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ error: 'Room not found. Check the code!' });

    const trimmedName = name.trim();
    if (!trimmedName) return cb({ error: 'Name cannot be empty.' });

    // Name already taken by a DIFFERENT active player
    if (room.players[trimmedName] && room.players[trimmedName].socketId !== socket.id) {
      return cb({ error: `"${trimmedName}" is already taken. Pick a different name!` });
    }

    const card = generateCard();
    const filledSet = new Set([12]);

    room.players[trimmedName] = {
      socketId: socket.id,
      card,
      filledSet,
      done: false,
    };

    socket.join(code);
    socket.data.room = code;
    socket.data.name = trimmedName;

    io.to(room.adminSocketId).emit('player_joined', {
      name: trimmedName,
      total: Object.keys(room.players).length,
    });

    cb({ card, filledIndices: [...filledSet] });
    io.to(code).emit('leaderboard', getRoomLeaderboard(room));
  });

  // ── Player: reconnect after refresh ────────────────────────────────────────
  socket.on('player_reconnect', ({ code, name }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ error: 'Room no longer exists. Ask the admin for a new code.' });

    const player = room.players[name];
    if (!player) return cb({ error: 'Player not found. You may have been removed.' });

    // Update socket ID
    player.socketId = socket.id;
    socket.join(code);
    socket.data.room = code;
    socket.data.name = name;

    cb({
      ok: true,
      card: player.card,
      filledIndices: [...player.filledSet],
      winner: room.winner,
    });

    io.to(code).emit('leaderboard', getRoomLeaderboard(room));
  });

  // ── Player: request confirmation from another player ────────────────────────
  socket.on('request_confirm', ({ index, confirmedByName }, cb) => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room) return cb({ error: 'Room not found. Try rejoining.' });

    const requesterName = socket.data.name;
    const requester = room.players[requesterName];
    if (!requester) return cb({ error: 'You are not in this game.' });
    if (requester.filledSet.has(index)) return cb({ ok: true, alreadyFilled: true });

    const trimmedConfirmer = confirmedByName.trim();
    const confirmerPlayer = room.players[trimmedConfirmer];
    if (!confirmerPlayer) {
      return cb({ error: `No player named "${trimmedConfirmer}" found. Check spelling — it must match exactly.` });
    }
    if (trimmedConfirmer.toLowerCase() === requesterName.toLowerCase()) {
      return cb({ error: "You cannot confirm yourself!" });
    }

    // Check confirm limit: has confirmerName already confirmed CONFIRM_LIMIT times for requesterName?
    const count = getConfirmCount(room, trimmedConfirmer, requesterName);
    if (count >= CONFIRM_LIMIT) {
      return cb({
        error: `${trimmedConfirmer} has already confirmed ${CONFIRM_LIMIT} squares for you. Find someone else!`,
      });
    }

    const pendingKey = `${requesterName}:${index}:${Date.now()}`;
    pending[pendingKey] = { requesterName, confirmerName: trimmedConfirmer, roomCode: code, index };

    // Auto-expire after 90 seconds
    setTimeout(() => {
      if (pending[pendingKey]) {
        const p = pending[pendingKey];
        delete pending[pendingKey];
        const r = rooms[p.roomCode];
        if (r && r.players[p.requesterName]) {
          io.to(r.players[p.requesterName].socketId).emit('confirm_expired', { index: p.index });
        }
      }
    }, 90000);

    io.to(confirmerPlayer.socketId).emit('confirm_request', {
      pendingKey,
      requesterName,
      activityText: requester.card[index].text,
      alreadyConfirmedCount: count,
      limit: CONFIRM_LIMIT,
    });

    cb({ ok: true, waiting: true });
  });

  // ── Confirmer responds ──────────────────────────────────────────────────────
  socket.on('confirm_response', ({ pendingKey, accepted }) => {
    const pend = pending[pendingKey];
    if (!pend) return; // expired or already handled

    const confirmerName = socket.data.name;
    if (pend.confirmerName.toLowerCase() !== confirmerName.toLowerCase()) return; // wrong socket

    delete pending[pendingKey];

    const room = rooms[pend.roomCode];
    if (!room) return;

    const requester = room.players[pend.requesterName];
    if (!requester) return;

    if (!accepted) {
      io.to(requester.socketId).emit('confirm_denied', {
        index: pend.index,
        activityText: requester.card[pend.index].text,
        deniedBy: confirmerName,
      });
      return;
    }

    // Double-check limit (race condition guard)
    if (getConfirmCount(room, confirmerName, pend.requesterName) >= CONFIRM_LIMIT) {
      io.to(requester.socketId).emit('confirm_denied', {
        index: pend.index,
        activityText: requester.card[pend.index].text,
        deniedBy: confirmerName,
      });
      return;
    }

    if (requester.filledSet.has(pend.index)) return;
    requester.filledSet.add(pend.index);
    incrementConfirmCount(room, confirmerName, pend.requesterName);

    if (requester.filledSet.size === 25) {
      requester.done = true;
      room.winner = pend.requesterName;
      io.to(pend.roomCode).emit('game_won', { winner: pend.requesterName });
    }

    io.to(requester.socketId).emit('square_confirmed', {
      index: pend.index,
      filled: [...requester.filledSet],
      confirmedBy: confirmerName,
    });

    io.to(pend.roomCode).emit('leaderboard', getRoomLeaderboard(room));
  });

  // ── Admin: reset game ───────────────────────────────────────────────────────
  socket.on('admin_reset', () => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room || room.adminSocketId !== socket.id) return;
    room.winner = null;
    room.confirmCounts = {}; // reset limits too
    for (const [name, p] of Object.entries(room.players)) {
      const card = generateCard();
      p.card = card;
      p.filledSet = new Set([12]);
      p.done = false;
      io.to(p.socketId).emit('new_card', { card, filledIndices: [12] });
    }
    io.to(code).emit('game_reset');
    io.to(code).emit('leaderboard', getRoomLeaderboard(room));
  });

  // ── Leaderboard on demand ───────────────────────────────────────────────────
  socket.on('get_leaderboard', () => {
    const code = socket.data.room;
    const room = rooms[code];
    if (room) socket.emit('leaderboard', getRoomLeaderboard(room));
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  // We do NOT remove the player on disconnect — they might just be refreshing.
  // The player entry persists in room.players so they can reconnect.
  socket.on('disconnect', () => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room) return;

    // Clean up pending confirmations for this socket
    for (const key of Object.keys(pending)) {
      const p = pending[key];
      if (
        (p.requesterName === socket.data.name && p.roomCode === code) ||
        (p.confirmerName === socket.data.name && p.roomCode === code)
      ) {
        delete pending[key];
      }
    }

    // Notify admin but don't remove from leaderboard (they can reconnect)
    if (room.adminSocketId && socket.data.name) {
      io.to(room.adminSocketId).emit('player_disconnected', { name: socket.data.name });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Securicon Bingo on port ${PORT}`));
