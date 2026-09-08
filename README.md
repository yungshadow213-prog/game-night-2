[README.md](https://github.com/user-attachments/files/31960236/README.md)
# Game Night — Main Build

This is the main Game Night build. It preserves the original Game Night interface and adds the development upgrades agreed for the project.

## Main upgrades
- Original visual interface retained as the foundation
- Mobile-first navigation, safe-area spacing and thumb-friendly controls
- Smoother page transitions
- Persistent Game Night account architecture
- Google Identity Services sign-in flow
- Server-side Google credential verification via Google's tokeninfo endpoint
- Persistent player profiles with unique Game Night player tags
- Custom image avatars plus built-in emoji avatars
- XP and level progression persisted to the account
- Persistent game statistics
- Profile-linked private chat identity
- Cross-session room resume foundation
- PWA support retained

## Google login setup
Set `GOOGLE_CLIENT_ID` in the server environment to the OAuth Web Client ID created in Google Cloud Console. The client ID must also allow the exact domain/origin where Game Night is hosted.

For local development, run for example:

Windows Command Prompt:
set GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
npm install
npm start

PowerShell:
$env:GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
npm install
npm start

Without `GOOGLE_CLIENT_ID`, the rest of the app still runs, but Google authentication cannot be completed.

## Run
1. Open Command Prompt in this folder.
2. Run `npm install` once.
3. Configure `GOOGLE_CLIENT_ID` when you want Google login.
4. Run `npm start`.
5. Open the local address shown by the server.

The app remains a private two-player real-time game.

## Game Night 2.0 final polish
- Original Game Night interface preserved.
- Chat Room is now a clean single-panel layout; the right-side information panel was removed.
- Added Log Out to the desktop sidebar and account menu, with mobile-friendly account access.
- Mobile navigation uses a swipeable horizontal rail instead of squeezing every item into tiny buttons.
- Added smoother page/button transitions with reduced-motion support.
- Reworked game prompts to sound more natural, playful, direct, and personal rather than generic AI-generated prompts.
- Google account/profile progression foundation remains in place.
