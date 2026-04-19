# 🎉 Securicon 11 — Human Bingo

A real-time multiplayer Human Bingo web app for Securicon 11th Edition.

## How to Play

1. **Admin** opens the site → clicks "Admin — Create Room" → shares the 6-letter room code
2. **Players** open the site on their phones → enter the room code + their name → get a randomized 5×5 card
3. To mark a square, tap it and enter the name of a player who matches that activity
4. **Win condition**: Fill ALL 25 squares (full card) — no partial bingo!
5. When someone wins, a celebration overlay fires for everyone

## Features

- 🔀 Every player gets a unique randomized card
- ✅ Anti-cheat: squares require another player's name to confirm
- 📊 Live leaderboard visible to all players in real-time
- 🏆 Win detection when full card is completed
- 🔄 Admin can reset and start a new game
- 📱 Mobile-first design

## Local Development

```bash
npm install
npm start
# open http://localhost:3000
```

## Deploy on Railway

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo — Railway auto-detects Node.js
4. Done! Railway gives you a public URL to share

## Activities (tuned for Tunisian uni students)

The 24 activities (+ FREE center) are designed for your audience:
- Tech/CS life (CTF, Linux, late-night coding, hackathons)
- Student life (energy drinks, startup ideas, all-night gaming)
- Social/cultural (speaks 3 languages, lived abroad, performed on stage)
- Lifestyle (night owl, cook a meal, photography, chess)
