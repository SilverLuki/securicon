const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Allow longer disconnect before cleanup — gives time to reconnect
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/sec", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html")),
);
app.get("/admin.html", (req, res) => res.redirect("/"));
app.use(
  express.static(path.join(__dirname, "public"), { index: "index.html" }),
);

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
  { id: 0, text: "Lived outside Tunisia" },
  { id: 1, text: "Plays a musical instrument" },
  { id: 2, text: "Written code at 3am" },
  { id: 3, text: "Addicted to coffee or energy drinks" },
  { id: 4, text: "Read 3 or more books this year" },
  { id: 5, text: "Solved a CTF challenge" },
  { id: 6, text: "Knows how to cook a full meal" },
  { id: 7, text: "Had an all-nighter gaming session" },
  { id: 8, text: "use mainly Linux" },
  { id: 9, text: "Draws, paints or designs" },
  { id: 10, text: "Exercises at least twice a week" },
  { id: 11, text: "Built or tinkered with hardware" },
  { id: 12, text: "Speaks 5 or more languages" },
  { id: 13, text: "Performed on stage" },
  { id: 14, text: "Dreams of working abroad in tech" },
  { id: 15, text: "Can do a magic trick" },
  { id: 16, text: "Knows how to swim" },
  { id: 17, text: "Plays chess regularly" },
  { id: 18, text: "Photography as a hobby" },
  { id: 19, text: "Won a hackathon or competition" },
  { id: 20, text: "Sleeps after 2am regularly" },
  { id: 21, text: "Has a startup idea written down" },
  { id: 22, text: "Met someone from another university today" },
  { id: 23, text: "3andou pc LENOVO" },
  { id: 24, text: "3andou pc MSI" },
  { id: 25, text: "3andou chache fih barcha alwan" },
  { id: 26, text: "hal CTF task 3al 1000pt" },
  { id: 27, text: "labes haja hamra" },
  { id: 28, text: "hafed joza 3ama fi el koran" },
  { id: 29, text: "labes lunette" },
  { id: 30, text: "labes SMART watch" },
  { id: 31, text: "l3ab Elden ring" },
  { id: 32, text: "labes haja hamra" },
  { id: 33, text: "Faked being sick to skip a TD or exam" },
  { id: 34, text: "Forgot to study but still passed because of cheating" },
  { id: 35, text: "Blamed the internet for missing a deadline" },
  { id: 36, text: "Copied a friend's homework and changed only the names" },
  { id: 37, text: "Said 'I'll start studying tomorrow' for a whole month" },
  { id: 38, text: "Submitted the same project to two different modules" },
  { id: 39, text: "Took credit for a group project you barely worked on" },
  { id: 40, text: "Left a Zoom/Google Meet before it ended" },
  { id: 41, text: "Pretended your mic was broken to avoid answering" },
  { id: 42, text: "Used a friend's ID to sign an attendance sheet" },
  {
    id: 43,
    text: "Slept through an 8am exam and lied about a family emergency",
  },
  { id: 44, text: "Spent more time choosing a Spotify playlist than studying" },
  { id: 45, text: "Used Google Translate for a whole English assignment" },
  { id: 46, text: "Borrowed a charger and never gave it back" },
  { id: 47, text: "Watched Netflix during an online lecture with camera off" },
  {
    id: 48,
    text: "Convinced a friend a wrong deadline was correct as a prank",
  },
  { id: 49, text: "Said 'I have no idea' when you actually knew the answer" },
  { id: 50, text: "Asked a question just to waste class time" },
  { id: 51, text: "Told a someone that the exam is easy when it's impossible" },
  { id: 52, text: "Sent a voice note longer than 5 minutes" },
  { id: 53, text: "Faked a relationship status to make someone jealous" },
  { id: 54, text: "Stalked an ex on social media" },
  { id: 55, text: "Lied about your grades to your parents" },
  { id: 56, text: "Pretended to be busy when a friend needed help" },
  { id: 57, text: "Read someone else's private messages without permission" },
  { id: 58, text: "Said 'I love you' just to get something" },
  { id: 59, text: "Ghosted a friend for no real reason" },
  { id: 60, text: "Used someone's personal struggle as gossip material" },
  { id: 61, text: "Took a photo of someone secretly and shared it" },
  { id: 62, text: "Pretended to be sick to avoid a social obligation" },
  { id: 63, text: "Blocked someone then unblocked them just to check" },
  { id: 64, text: "Made a fake account to mess with someone" },
  { id: 65, text: "Told your parents you were studying but you were out" },
  { id: 66, text: "Faked a screenshot to prove something false" },
  { id: 67, text: "Laughed at a mean joke about someone present" },
  { id: 68, text: "Started a rumor just to see what happens" },
  { id: 69, text: "Pretended not to see a message for days" },
  { id: 70, text: "Took credit for an idea that wasn't yours" },
  { id: 71, text: "Lied about having plans to avoid hanging out" },
  {
    id: 72,
    text: "Compared your life to someone's highlight reel and felt bad",
  },
  { id: 73, text: "Told someone 'you look fine' when they clearly don't" },
  { id: 74, text: "Still calls data '3G'" },
  { id: 75, text: "Uses 'mazelt hay' to answer 'chnahwalek ?'" },
  { id: 76, text: "Pretended not to hear someone greet you to avoid talking" },
  { id: 77, text: "Said 'na3mel bih chnowa?' when someone shared good news" },
  {
    id: 78,
    text: "Has a parent who sends you Facebook recipes and expects you to cook them",
  },
  { id: 79, text: "Has ever argued with a taxi driver over 500 millimes" },
  {
    id: 80,
    text: "Has hidden snacks in your room so your siblings don't find them",
  },
  { id: 81, text: "Says 'la' but means 'maybe' and 'maybe' means 'never'" },
  { id: 82, text: "Pretended you didn't have money to avoid lending some" },
  {
    id: 83,
    text: "Knows the exact time the baker sells fresh bread in your neighborhood",
  },
  { id: 84, text: "Watched a drama just to laugh at the acting" },
  {
    id: 85,
    text: "Has an uncle who asks 'chnowa ta9ra?' and then explains your major wrong to everyone",
  },
  { id: 86, text: "Uses 'mrigla' to describe something actually terrible" },
  {
    id: 87,
    text: "Has a WhatsApp group named something like 'a9wa nas' or 'Rey9in'",
  },
  { id: 88, text: "Cried secretly in the bathroom at least once this year" },
  { id: 89, text: "Still thinks about someone you never confessed to" },
  { id: 90, text: "Felt completely lost about your future this month" },
  { id: 91, text: "Googled 'am I depressed' but never told anyone" },
  { id: 92, text: "Pretended to be happy when you were breaking inside" },
  {
    id: 93,
    text: "Has a secret social media account your family doesn't know about",
  },
  { id: 94, text: "Said 'it's fine' when it was absolutely not fine" },
  { id: 95, text: "Compared yourself to a classmate and felt like a failure" },
  { id: 96, text: "Has a toxic friend you're too scared to cut off" },
  {
    id: 97,
    text: "Faked being confident during a presentation but your hands were shaking",
  },
  { id: 98, text: "Regretted a major life choice but won't admit it out loud" },
  { id: 99, text: "Felt genuinely lonely even in a crowded room" },
  {
    id: 100,
    text: "Stayed in a relationship because you didn't want to be alone",
  },
  { id: 101, text: "Cried over an exam grade then lied about it to friends" },
  {
    id: 102,
    text: "Snooped through someone's phone while they were in the bathroom",
  },
  {
    id: 103,
    text: "Told a friend 'I'm busy' but you were just watching TikTok",
  },
  { id: 104, text: "Has a secret you've never told any living person" },
  {
    id: 105,
    text: "Felt jealous of a friend's success and hated yourself for it",
  },
  {
    id: 106,
    text: "Pretended to understand a meme to avoid looking old or out of touch",
  },
  { id: 107, text: "Snoozed Fajr alarm more than 5 times in one morning" },
  { id: 108, text: "Said 'Bismillah' before cheating on a test out of habit" },
  {
    id: 109,
    text: "Used 'Inshallah' for something you'll definitely never do",
  },
  {
    id: 110,
    text: "Has a Quran app on your phone but haven't opened it in months",
  },
  {
    id: 111,
    text: "Said 'Rabi yostor' when someone almost caught you doing something wrong",
  },
  { id: 112, text: "Has a friend who only becomes religious during exam week" },
  { id: 113, text: "read Ayat Al-Kursi before sleeping" },
  {
    id: 114,
    text: "Started a group project but did everything yourself because 'it's faster'",
  },
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
  const pool = ACTIVITIES.filter((a) => a.id !== 24);
  const picked = shuffle(pool).slice(0, 24);
  picked.splice(12, 0, ACTIVITIES[24]);
  return picked;
}

function generateRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function getRoomLeaderboard(room) {
  return Object.entries(room.players)
    .map(([name, p]) => ({
      name,
      filled: p.filledSet.size,
      total: 25,
      done: p.done,
    }))
    .sort((a, b) => b.filled - a.filled);
}

// How many times confirmerName has confirmed for requesterName in this room
function getConfirmCount(room, confirmerName, requesterName) {
  return room.confirmCounts[confirmerName]?.[requesterName] || 0;
}

function incrementConfirmCount(room, confirmerName, requesterName) {
  if (!room.confirmCounts[confirmerName])
    room.confirmCounts[confirmerName] = {};
  room.confirmCounts[confirmerName][requesterName] =
    getConfirmCount(room, confirmerName, requesterName) + 1;
}

// ── Socket Events ─────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  // ── Admin: create room ──────────────────────────────────────────────────────
  socket.on("create_room", ({ adminName }, cb) => {
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
  socket.on("admin_reconnect", ({ code, adminName }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ error: "Room no longer exists." });
    if (room.adminName !== adminName) return cb({ error: "Not authorized." });

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
  socket.on("join_room", ({ code, name }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ error: "Room not found. Check the code!" });

    const trimmedName = name.trim();
    if (!trimmedName) return cb({ error: "Name cannot be empty." });

    // Name already taken by a DIFFERENT active player
    if (
      room.players[trimmedName] &&
      room.players[trimmedName].socketId !== socket.id
    ) {
      return cb({
        error: `"${trimmedName}" is already taken. Pick a different name!`,
      });
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

    io.to(room.adminSocketId).emit("player_joined", {
      name: trimmedName,
      total: Object.keys(room.players).length,
    });

    cb({ card, filledIndices: [...filledSet] });
    io.to(code).emit("leaderboard", getRoomLeaderboard(room));
  });

  // ── Player: reconnect after refresh ────────────────────────────────────────
  socket.on("player_reconnect", ({ code, name }, cb) => {
    const room = rooms[code];
    if (!room)
      return cb({
        error: "Room no longer exists. Ask the admin for a new code.",
      });

    const player = room.players[name];
    if (!player)
      return cb({ error: "Player not found. You may have been removed." });

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

    io.to(code).emit("leaderboard", getRoomLeaderboard(room));
  });

  // ── Player: request confirmation from another player ────────────────────────
  socket.on("request_confirm", ({ index, confirmedByName }, cb) => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room) return cb({ error: "Room not found. Try rejoining." });

    const requesterName = socket.data.name;
    const requester = room.players[requesterName];
    if (!requester) return cb({ error: "You are not in this game." });
    if (requester.filledSet.has(index))
      return cb({ ok: true, alreadyFilled: true });

    const trimmedConfirmer = confirmedByName.trim();
    const confirmerPlayer = room.players[trimmedConfirmer];
    if (!confirmerPlayer) {
      return cb({
        error: `No player named "${trimmedConfirmer}" found. Check spelling — it must match exactly.`,
      });
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
    pending[pendingKey] = {
      requesterName,
      confirmerName: trimmedConfirmer,
      roomCode: code,
      index,
    };

    // Auto-expire after 90 seconds
    setTimeout(() => {
      if (pending[pendingKey]) {
        const p = pending[pendingKey];
        delete pending[pendingKey];
        const r = rooms[p.roomCode];
        if (r && r.players[p.requesterName]) {
          io.to(r.players[p.requesterName].socketId).emit("confirm_expired", {
            index: p.index,
          });
        }
      }
    }, 90000);

    io.to(confirmerPlayer.socketId).emit("confirm_request", {
      pendingKey,
      requesterName,
      activityText: requester.card[index].text,
      alreadyConfirmedCount: count,
      limit: CONFIRM_LIMIT,
    });

    cb({ ok: true, waiting: true });
  });

  // ── Confirmer responds ──────────────────────────────────────────────────────
  socket.on("confirm_response", ({ pendingKey, accepted }) => {
    const pend = pending[pendingKey];
    if (!pend) return; // expired or already handled

    const confirmerName = socket.data.name;
    if (pend.confirmerName.toLowerCase() !== confirmerName.toLowerCase())
      return; // wrong socket

    delete pending[pendingKey];

    const room = rooms[pend.roomCode];
    if (!room) return;

    const requester = room.players[pend.requesterName];
    if (!requester) return;

    if (!accepted) {
      io.to(requester.socketId).emit("confirm_denied", {
        index: pend.index,
        activityText: requester.card[pend.index].text,
        deniedBy: confirmerName,
      });
      return;
    }

    // Double-check limit (race condition guard)
    if (
      getConfirmCount(room, confirmerName, pend.requesterName) >= CONFIRM_LIMIT
    ) {
      io.to(requester.socketId).emit("confirm_denied", {
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
      io.to(pend.roomCode).emit("game_won", { winner: pend.requesterName });
    }

    io.to(requester.socketId).emit("square_confirmed", {
      index: pend.index,
      filled: [...requester.filledSet],
      confirmedBy: confirmerName,
    });

    io.to(pend.roomCode).emit("leaderboard", getRoomLeaderboard(room));
  });

  // ── Admin: reset game ───────────────────────────────────────────────────────
  socket.on("admin_reset", () => {
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
      io.to(p.socketId).emit("new_card", { card, filledIndices: [12] });
    }
    io.to(code).emit("game_reset");
    io.to(code).emit("leaderboard", getRoomLeaderboard(room));
  });

  // ── Leaderboard on demand ───────────────────────────────────────────────────
  socket.on("get_leaderboard", () => {
    const code = socket.data.room;
    const room = rooms[code];
    if (room) socket.emit("leaderboard", getRoomLeaderboard(room));
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  // We do NOT remove the player on disconnect — they might just be refreshing.
  // The player entry persists in room.players so they can reconnect.
  socket.on("disconnect", () => {
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
      io.to(room.adminSocketId).emit("player_disconnected", {
        name: socket.data.name,
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Securicon Bingo on port ${PORT}`));
