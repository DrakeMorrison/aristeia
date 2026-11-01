# vendor

The Automerge build that `../sync.js` loads once a device is paired, committed
here so sync depends on no CDN: all the apps share one origin, and their
Beeminder tokens and Slack webhook with it. Nothing here runs on a device that
isn't syncing.

- `automerge.wasm` is `dist/automerge.wasm` from `@automerge/automerge@3.5.0`.
- `automerge.js` is an esbuild bundle of `@automerge/vanillajs@2.5.6` (slim) and
  `@automerge/automerge@3.5.0` (slim), bundled together so they share one wasm
  instance:

```js
// entry.js
export { Repo, ImmutableString, initializeWasm, IndexedDBStorageAdapter, WebSocketClientAdapter, BroadcastChannelNetworkAdapter } from '@automerge/vanillajs/slim';
export { next as Automerge } from '@automerge/automerge/slim';
```

```sh
npx esbuild entry.js --bundle --format=esm --platform=browser --minify --outfile=automerge.js --define:global=globalThis
```

The server's `@automerge/automerge` major version must stay compatible.
