# chromoscientia-shared

Shared code and assets for Chromoscientia (web and mobile). Same GitHub org as **chromoscientia_web** and **chromoscientia_mobile**.

## Layout

- **game-core/** – Shared game logic (types, color, rules). No React/Firebase.
- **shared/** – i18n (en/es), scoring, colorContrast, injectable room API. Exports `createRoomApi(getDb, getOrCreatePlayerId)`.
- **shared/assets/** – Logos, icons, gradient-bg.lottie. Web copies into `public/`; mobile bundles via Metro.

## Use as submodule

In **chromoscientia_web** and **chromoscientia_mobile**:

```bash
git submodule add https://github.com/YOUR_ORG/chromoscientia-shared.git packages/shared
```

Then depend on `file:./packages/shared/game-core` and `file:./packages/shared/shared` (or `./packages/shared` for the shared package from the repo root).

## Build

```bash
cd game-core && npm install && npm run build
cd ../shared && npm install && npm run build
```

## Submodule workflow

When you change code here: commit and push in this repo, then in web/mobile run `git submodule update --remote packages/shared`, commit the updated ref, and push.
