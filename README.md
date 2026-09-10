[Uploading README.md…]()
# Game Night 3.0

Main 3.0 build, bug-fixed for local multiplayer testing.

Key fixes in this maintenance build:
- Reliable Socket.IO connection/resume flow
- Private room create/join acknowledgements
- Chat room history hydration without UI blinking
- Stable navigation during live state broadcasts
- Game selection/start acknowledgements
- Preserved 10-game question banks
- Profile customization persistence
- PWA cache/version refresh

Run:
```
npm install
npm start
```
Then open http://localhost:3000.
