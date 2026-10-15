# Kaduna Lifestyle — PWA (Installable App) + Vehicle Fixes + Error Fix (Oct 15)

Three things in this zip:

1. **PWA** — the game is now installable as an app. Users can "Add to Home
   Screen" on Android/Chrome/Edge, or "Add to Dock" on macOS Safari.
   Includes manifest.json, service worker (offline caching), app icons,
   iOS meta tags, and a floating "📥 Install" button.

2. **Vehicle fixes** — acceleration (ramp from 0), steering controls
   (left/right = steering when riding), faster than walking, hide
   player's feet under the vehicle.

3. **Error fix** — the red "TypeError: Cannot set properties of
   undefined (setting 'value')" banner at the top of the screen was
   caused by `graphics.js` trying to set a non-existent "exposure"
   uniform on the Three.js Sky shader. Fixed.

> NOTE: `vite.config.js` was NOT touched.

## Build status
`npx vite build` -> built in 3.02s, no errors.

## FILES IN THIS ZIP

```
public/manifest.json    (NEW — PWA manifest: name, icons, display=standalone)
public/sw.js            (NEW — service worker: cache-first for static, network for Firebase)
public/icon-192.svg     (NEW — 192x192 app icon, green bg + gold "K")
public/icon-512.svg     (NEW — 512x512 app icon)
public/icon.svg         (NEW — any-size icon)
index.html              (MODIFIED — manifest link + apple-mobile-web-app meta tags + SW registration script)
src/main.js             (MODIFIED — PWA install prompt + vehicle control scheme + hide feet + auto-dismount)
src/graphics.js         (MODIFIED — removed non-existent "exposure" uniform + added try/catch on Sky uniforms)
```

## WHAT THE PWA DOES

After pushing this + deploying to Vercel:
1. Visit kaduna-lifestyle.vercel.app on Chrome/Edge mobile.
2. A gold "📥 Install" button appears at the top-right.
3. Tap it → browser's native install dialog → "Install Kaduna Lifestyle".
4. App icon appears on the home screen (green "K" on gold).
5. Launch from home screen → opens in FULL SCREEN (no browser URL bar).
6. Works OFFLINE — the service worker caches the app shell (HTML, JS,
   CSS, kaduna.json data). Firebase API calls still need network.
7. On iOS Safari → "Add to Home Screen" manually (iOS doesn't show
   the install prompt, but the meta tags make it full-screen when
   launched from the home screen).

## TEST PLAN

### PWA install
1. Deploy to Vercel.
2. On Android Chrome: visit the site → see "📥 Install" button → tap → install.
3. App appears on home screen with the "K" icon.
4. Launch → full screen, no URL bar.
5. Turn off network → app still loads (cached app shell).
6. On desktop Chrome: click the install icon in the URL bar.

### Vehicle controls
1. Buy an Okada → Ride → push joystick UP → accelerates from 0 (not instant).
2. Push LEFT/RIGHT → vehicle STEERS.
3. Speed is noticeably faster than walking.
4. No feet visible under the vehicle.
5. Enter a building → auto-dismount.

### Error fix
1. No more red error banner at the top.
2. Console shows `[PWA] Service Worker registered: /`.

## NEXT STEPS

Say "next" for more features — phone apps, FOR RENT/FOR SALE boards, etc.
