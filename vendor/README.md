# vendor

The Automerge build that `../sync.js` loads once a device is paired, committed
here so sync depends on no CDN: all the apps share one origin, and their
Beeminder tokens and Slack webhook with it. Nothing here runs on a device that
isn't syncing.

- `automerge.wasm` is `dist/automerge.wasm` from `@automerge/automerge@3.5.0`.
- `automerge.js` is an esbuild bundle of `@automerge/vanillajs@2.5.6` (slim),
  `@automerge/automerge@3.5.0` (slim), `@noble/ciphers@2.0.1` and
  `@noble/hashes@2.0.1`, with Automerge bundled together so it has one wasm
  instance:

```js
// entry.js
export { Repo, initializeWasm, IndexedDBStorageAdapter, WebSocketClientAdapter, BroadcastChannelNetworkAdapter } from '@automerge/vanillajs/slim';
export { next as Automerge } from '@automerge/automerge/slim';
export { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
export { hkdf } from '@noble/hashes/hkdf.js';
export { hmac } from '@noble/hashes/hmac.js';
export { sha256 } from '@noble/hashes/sha2.js';
```

```sh
npx esbuild entry.js --bundle --format=esm --platform=browser --minify --outfile=automerge.js --define:global=globalThis
```

The noble version must stay able to open what older devices wrote; `sync.js`
names its format `aristeia sync v1`.
