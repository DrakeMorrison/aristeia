// Shared Automerge sync for the aristeia apps.
//
// One sync link pairs a device for every app. The link names a root doc that
// maps each app to its own doc, so opening gnomon never loads kleio's history.
//
// An app keeps its localStorage and in-memory state exactly as before and
// describes each synced store to register(); its save functions call touch().
// Local edits become field-level writes by diffing the app's state against a
// shadow of what was last synced, which is why a stale device can't undo a
// remote edit it never saw, and why edits made before the library has loaded
// (or with no network) need no journal: they are simply still in the diff.
//
// Everything in a doc is end-to-end encrypted. The key travels only in the `#`
// part of the sync link and in each device's localStorage, so the server stores
// ciphertext. It still sees how many records and fields there are, their sizes
// and when they change, and since it holds the docs it can withhold or delete.
//
// Doc layout: flat top-level keys, each a keyed hash of `<store>/<recordId>`,
// holding a map from a keyed hash of each field name to its sealed value, plus
// `_`, the sealed store and id. There are no parent maps to create, because two
// devices creating the same parent offline would conflict and one side's whole
// subtree would vanish. Hashes are deterministic so that devices agree on where
// a record lives; values use random nonces and are bound to their location, so
// one can't be moved elsewhere. Each field stays an atomic register that merges
// on its own. Reading decrypts only the records that changed, since opening an
// app after five years of data would otherwise stall a phone for seconds.
(() => {
  'use strict';

  const CFG_KEY = 'aristeia_sync';
  const STATE_PREFIX = 'aristeia_sync_state_';
  const BASE = new URL('./', document.currentScript ? document.currentScript.src : location.href).href;
  const LIB = BASE + 'vendor/automerge.js';
  const WASM = BASE + 'vendor/automerge.wasm';
  // Automerge's public test server: no account or VPN needed on any device. It
  // promises to keep nothing, but every device holds a full copy regardless.
  const DEFAULT_SERVER = 'wss://sync.automerge.org';
  const APPS = ['meridian', 'gnomon', 'pharmakon', 'halteres', 'nbacking', 'peira', 'kleio'];
  const URL_RE = /automerge:[1-9A-HJ-NP-Za-km-z]+/;
  const KEY_RE = /[#&?]key=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/;
  const CLEAR_STORE = '__clear'; // records an explicit Clear, sealed like any other
  const PUSH_DELAY = 300;
  const PULL_DELAY = 150;
  const BUSY_POLL = 2000;
  const RETRY_EVERY = 30000;
  const FIND_TIMEOUT = 20000;
  // A save that would drop this much of a store is treated as lost local data
  // (a failed read, evicted localStorage) unless the app said it meant it. The
  // same goes for a doc that suddenly lost most of a store with no Clear recorded,
  // which is what a misbehaving server looks like.
  const MASS_DELETE_MIN = 10;

  // ── Encoding ───────────────────────────────────────────────────
  // "enc" is a field's comparable form: number, boolean, null or JSON string.
  function encVal(v) {
    if (v === undefined) return undefined;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'boolean' || v === null) return v;
    return JSON.stringify(v);
  }
  function decVal(enc) {
    if (typeof enc !== 'string') return enc;
    try { return JSON.parse(enc); } catch (e) { return undefined; }
  }

  function encodeRec(rec, spec) {
    const out = {};
    for (const [f, v] of Object.entries(rec)) {
      if (spec.flatten && spec.flatten.includes(f) && v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          const e = encVal(x);
          if (e !== undefined) out[f + '/' + k] = e;
        }
        continue;
      }
      const e = encVal(v);
      if (e !== undefined) out[f] = e;
    }
    return out;
  }
  function decodeRec(enc, spec) {
    const out = {};
    for (const f of spec.flatten || []) out[f] = {};
    for (const [f, e] of Object.entries(enc)) {
      const slash = f.indexOf('/');
      const parent = slash > 0 ? f.slice(0, slash) : null;
      if (parent && spec.flatten && spec.flatten.includes(parent)) out[parent][f.slice(slash + 1)] = decVal(e);
      else out[f] = decVal(e);
    }
    return out;
  }

  function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function sameRec(a, b) {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
  }

  // Records with the same id but different content (old logs have a few) get
  // a content-suffixed key rather than overwriting one another.
  function encodeStore(recs, spec) {
    const out = Object.create(null);
    for (const r of recs) {
      const enc = encodeRec(r, spec);
      let key = String(r.id);
      if (out[key] && !sameRec(out[key], enc)) key += '~' + hashStr(JSON.stringify(enc));
      out[key] = enc;
    }
    return out;
  }

  function diffStore(prev, next) {
    const creates = [], puts = [], removes = [];
    for (const key of Object.keys(next)) {
      const a = prev[key], b = next[key];
      if (!a) { creates.push([key, b]); continue; }
      const set = {}, del = [];
      for (const f of Object.keys(b)) if (a[f] !== b[f]) set[f] = b[f];
      for (const f of Object.keys(a)) if (!(f in b)) del.push(f);
      if (Object.keys(set).length || del.length) puts.push([key, set, del]);
    }
    for (const key of Object.keys(prev)) if (!next[key]) removes.push(key);
    return { creates, puts, removes };
  }
  const emptyDiff = o => !o.creates.length && !o.puts.length && !o.removes.length;
  const isMassRemoval = (ops, had) => ops.removes.length >= MASS_DELETE_MIN && ops.removes.length * 2 > had;

  // ── Encryption ─────────────────────────────────────────────────
  const utf8 = new TextEncoder(), unutf8 = new TextDecoder();
  function b64url(bytes) {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(str) {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  }

  const stats = { opens: 0 };

  // One subkey pair per doc, so a value can't be replayed from another app.
  function makeCipher(n, rootKey, doc) {
    const sub = purpose => n.hkdf(n.sha256, rootKey, undefined, utf8.encode('aristeia sync v1 ' + purpose + ' ' + doc), 32);
    const sealKey = sub('seal'), nameKey = sub('name');
    const hash = (str, len) => b64url(n.hmac(n.sha256, nameKey, utf8.encode(str)).subarray(0, len));
    const fields = new Map();
    const NONCE = 24;
    return {
      top: (store, key) => hash('r/' + store + '/' + key, 12),
      field(store, f) {
        const k = store + '/' + f;
        if (!fields.has(k)) fields.set(k, hash('f/' + k, 8));
        return fields.get(k);
      },
      seal(value, top, field) {
        const nonce = crypto.getRandomValues(new Uint8Array(NONCE));
        const ct = n.xchacha20poly1305(sealKey, nonce, utf8.encode(top + '/' + field)).encrypt(utf8.encode(JSON.stringify(value)));
        const out = new Uint8Array(NONCE + ct.length);
        out.set(nonce);
        out.set(ct, NONCE);
        return out;
      },
      // Returns undefined for anything forged, corrupt or sealed under another key.
      open(bytes, top, field) {
        stats.opens++;
        if (!(bytes instanceof Uint8Array) || bytes.length <= NONCE) return undefined;
        try {
          const pt = n.xchacha20poly1305(sealKey, bytes.subarray(0, NONCE), utf8.encode(top + '/' + field)).decrypt(bytes.subarray(NONCE));
          return JSON.parse(unutf8.decode(pt));
        } catch (e) {
          return undefined;
        }
      },
    };
  }

  // Seals a create or a set of field changes into the doc.
  function applyDiff(d, store, ops, C) {
    const write = (r, top, f, enc) => {
      const fk = C.field(store, f);
      r[fk] = C.seal([f, decVal(enc)], top, fk);
    };
    for (const [key, rec] of ops.creates) {
      const top = C.top(store, key);
      if (!d[top]) d[top] = { _: C.seal([store, key], top, '_') };
      for (const f of Object.keys(rec)) write(d[top], top, f, rec[f]);
    }
    for (const [key, set, del] of ops.puts) {
      const top = C.top(store, key);
      const r = d[top];
      if (!r) continue; // deleted elsewhere: a delete beats a concurrent edit
      for (const f of Object.keys(set)) write(r, top, f, set[f]);
      for (const f of del) delete r[C.field(store, f)];
    }
    for (const key of ops.removes) delete d[C.top(store, key)];
  }

  // A sealed field's value, falling back on its concurrent values if the winner
  // doesn't open, so that a forged write can't hide a real one it raced with.
  function openField(raw, top, fk, C, A) {
    const v = C.open(raw[fk], top, fk);
    if (v !== undefined) return v;
    const c = A.getConflicts(raw, fk);
    for (const id of c ? Object.keys(c).sort() : []) {
      const alt = C.open(c[id], top, fk);
      if (alt !== undefined) return alt;
    }
    return undefined;
  }

  // One record → { store, key, enc }, or null if it isn't readable. A field with
  // a resolver has its concurrent values run through it. A resolver only ever
  // sees concurrent writes (a write made after seeing another simply replaces
  // it) and must be deterministic.
  function readRecord(raw, top, stores, C, A) {
    if (!raw || typeof raw !== 'object') return null;
    const id = C.open(raw._, top, '_');
    if (!Array.isArray(id) || !stores[id[0]]) return null;
    const [store, key] = id;
    const spec = stores[store], enc = {}, forged = new Set();
    for (const fk of Object.keys(raw)) {
      if (fk === '_') continue;
      const opened = openField(raw, top, fk, C, A);
      if (!Array.isArray(opened)) { forged.add(fk); continue; }
      const [f, v] = opened;
      enc[f] = encVal(v);
      const fn = spec.resolve && spec.resolve[f];
      if (!fn) continue;
      const c = A.getConflicts(raw, fk);
      const vals = (c ? Object.keys(c).sort() : []).map(i => C.open(c[i], top, fk)).filter(Array.isArray).map(x => x[1]);
      if (vals.length > 1) enc[f] = encVal(fn(vals));
    }
    return { store, key, enc, forged };
  }

  // Doc → { store: { key: encRec } } for the whole doc.
  function readDoc(doc, stores, C, A) {
    const out = {};
    for (const s of Object.keys(stores)) out[s] = Object.create(null);
    for (const top of Object.keys(doc)) {
      const r = readRecord(doc[top], top, stores, C, A);
      if (r) out[r.store][r.key] = r.enc;
    }
    return out;
  }

  // What the app would hold if it adopted this record, or null if it wouldn't.
  function normalizeRec(enc, spec) {
    const clean = spec.clean([decodeRec(enc, spec)]);
    return clean.length ? encodeRec(clean[0], spec) : null;
  }
  function normalize(encMap, spec) {
    const out = Object.create(null);
    for (const key of Object.keys(encMap)) {
      const n = normalizeRec(encMap[key], spec);
      if (n) out[key] = n;
    }
    return out;
  }

  // Tells whether local data changed since it last matched the doc, without
  // decrypting anything. A collision would at worst delay pushing an edit.
  function digest(stores) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    const mix = str => {
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
      }
    };
    for (const s of Object.keys(stores).sort()) {
      mix(s);
      const map = stores[s];
      for (const key of Object.keys(map).sort()) {
        mix('\u0001' + key);
        const rec = map[key];
        for (const f of Object.keys(rec).sort()) mix('\u0002' + f + '\u0003' + String(rec[f]));
      }
    }
    return ((h1 >>> 0).toString(36)) + '.' + ((h2 >>> 0).toString(36));
  }

  // ── Pairing config ─────────────────────────────────────────────
  function loadLS(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function saveLS(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }
  function loadCfg() {
    const c = loadLS(CFG_KEY);
    return c && typeof c === 'object' && typeof c.root === 'string' && typeof c.key === 'string' ? c : null;
  }
  function serverUrl() {
    const c = loadLS(CFG_KEY);
    return (c && c.server) || DEFAULT_SERVER;
  }

  // ── Library and repo ───────────────────────────────────────────
  let lib = null, repo = null, serverPeers = 0;
  async function ensureLib() {
    if (lib) return lib;
    const m = await import(LIB);
    await m.initializeWasm(WASM);
    return (lib = m);
  }
  async function ensureRepo(scope) {
    await ensureLib();
    if (repo) return repo;
    repo = new lib.Repo({
      storage: new lib.IndexedDBStorageAdapter('aristeia-sync'),
      network: [
        new lib.WebSocketClientAdapter(serverUrl()),
        // Scoped per app so that two open apps don't load each other's docs.
        new lib.BroadcastChannelNetworkAdapter({ channelName: 'aristeia-' + scope }),
      ],
    });
    const isServer = id => String(id).startsWith('storage-server');
    repo.networkSubsystem.on('peer', ({ peerId }) => { if (isServer(peerId)) { serverPeers++; renderStatus(); } });
    repo.networkSubsystem.on('peer-disconnected', ({ peerId }) => {
      if (isServer(peerId)) { serverPeers = Math.max(0, serverPeers - 1); renderStatus(); }
    });
    return repo;
  }
  function findDoc(url) {
    return Promise.race([
      repo.find(url),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timed out reaching the sync server')), FIND_TIMEOUT)),
    ]);
  }

  // ── Status ─────────────────────────────────────────────────────
  let starting = null, lastError = '', onStatus = null, attached = false;
  function status() {
    if (!loadCfg()) return 'off';
    if (starting) return 'connecting';
    if (!attached) return 'error';
    return serverPeers > 0 ? 'online' : 'offline';
  }
  const STATUS_TEXT = {
    off: 'not syncing on this device',
    connecting: 'connecting to sync.automerge.org…',
    online: 'synced through sync.automerge.org',
    offline: 'can\'t reach sync.automerge.org. Changes are kept and sync later.',
    error: 'can\'t load the sync doc yet — changes are kept here and sync later.',
  };
  function renderStatus() {
    const s = status();
    const text = STATUS_TEXT[s] + (s === 'error' && lastError ? ' (' + lastError + ')' : '');
    if (typeof document.querySelectorAll === 'function') {
      for (const el of document.querySelectorAll('[data-aristeia-sync]')) el.textContent = text;
    }
    if (onStatus) onStatus(s, text);
  }

  // ── App attachment ─────────────────────────────────────────────
  let app = null;        // the spec given to register()
  let handle = null;     // the app's DocHandle once attached
  let cipher = null;
  let allStores = {};    // the app's stores plus the Clear record
  let attachedRoot = null;
  let shadow = {};       // store → last synced enc map
  let appliedHeads = ''; // doc heads that `shadow` and app state reflect
  let clears = {};       // store → its Clear record as last seen
  let applying = false;
  let allowMassDelete = false;
  let pendingPull = false;
  const dirty = new Set();
  let pushTimer = null, pullTimer = null;

  const headsStr = doc => lib.Automerge.getHeads(doc).join(',');
  const rootKeyOf = cfg => unb64url(cfg.key);
  // Sanitized, so that a record compares equal before and after a reload runs
  // it through the same sanitizer.
  const encodeLocalStore = spec => encodeStore(spec.clean(spec.read()), spec);
  function encodeLocal() {
    const out = {};
    for (const [s, spec] of Object.entries(app.stores)) out[s] = encodeLocalStore(spec);
    return out;
  }
  function saveState(url) {
    saveLS(STATE_PREFIX + app.app, { url, heads: appliedHeads.split(','), digest: digest(shadow), clears });
  }

  // The root doc maps a hash of each app's name to its sealed doc URL.
  function readRoot(doc, C) {
    const out = {};
    const apps = (doc && doc.apps) || {};
    for (const top of Object.keys(apps)) {
      const v = C.open(apps[top], top, 'app');
      if (Array.isArray(v)) out[v[0]] = v[1];
    }
    return out;
  }

  async function appDocUrl(cfg) {
    if (cfg.apps && cfg.apps[app.app]) return cfg.apps[app.app];
    const root = await findDoc(cfg.root);
    const C = makeCipher(lib, rootKeyOf(cfg), 'root');
    let url = readRoot(root.doc(), C)[app.app];
    if (!url) { // an app newer than the pairing
      const fresh = repo.create({ v: 1 }).url;
      const top = C.top('app', app.app);
      root.change(d => { if (!d.apps) d.apps = {}; d.apps[top] = C.seal([app.app, fresh], top, 'app'); });
      url = readRoot(root.doc(), C)[app.app];
    }
    cfg.apps = { ...(cfg.apps || {}), [app.app]: url };
    saveLS(CFG_KEY, cfg);
    return url;
  }

  function writeOps(h, writes) {
    h.change(d => { for (const [s, ops] of writes) applyDiff(d, s, ops, cipher); });
  }

  function attach(h, url) {
    const A = lib.Automerge;
    const doc = h.doc();
    const st = loadLS(STATE_PREFIX + app.app);
    const known = st && st.url === url && Array.isArray(st.heads) && st.heads[0] && A.hasHeads(doc, st.heads);
    const local = encodeLocal();
    let restoring = false;
    clears = (st && st.url === url && st.clears) || {};
    handle = h;
    attached = true;
    shadow = local;
    h.on('change', schedulePull);
    if (known && st.digest === digest(local)) {
      // The usual open: local data is exactly what the doc held at the bookmark,
      // so only what arrived since then needs decrypting.
      appliedHeads = st.heads.join(',');
      pull();
      return afterAttach();
    }
    appliedHeads = '';
    const writes = [];
    if (known) {
      // The app changed something after it last synced, perhaps while closed.
      const base = readDoc(st.heads.join(',') === headsStr(doc) ? doc : A.view(doc, st.heads), allStores, cipher, A);
      for (const [s, spec] of Object.entries(app.stores)) {
        const before = normalize(base[s], spec);
        const ops = diffStore(before, local[s]);
        if (isMassRemoval(ops, Object.keys(before).length)) { restoring = true; continue; }
        if (!emptyDiff(ops)) writes.push([s, ops]);
      }
      if (writes.length) writeOps(h, writes);
      // With those written, only what arrived since the bookmark is left to read.
      if (!restoring) appliedHeads = st.heads.join(',');
      pull({ seed: restoring });
    } else {
      // First contact (or the bookmark was lost): merge in what the doc lacks,
      // and otherwise adopt the doc.
      const inDoc = readDoc(doc, allStores, cipher, A);
      const next = {};
      for (const c of Object.keys(inDoc[CLEAR_STORE])) clears[c] = inDoc[CLEAR_STORE][c].n;
      for (const [s, spec] of Object.entries(app.stores)) {
        next[s] = normalize(inDoc[s], spec);
        const creates = Object.keys(local[s]).filter(k => !inDoc[s][k]).map(k => [k, local[s][k]]);
        for (const [k, rec] of creates) next[s][k] = rec;
        if (creates.length) writes.push([s, { creates, puts: [], removes: [] }]);
      }
      if (writes.length) writeOps(h, writes);
      pull({ seed: true, read: { next, fresh: {} } });
    }
    afterAttach();
  }

  function afterAttach() {
    if (['gnomon', 'pharmakon'].includes(app.app)) { // the old per-app prototypes
      localStorage.removeItem(app.app + '_sync');
      try { indexedDB.deleteDatabase(app.app + '-sync'); } catch (e) {}
    }
  }

  function push() {
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    if (!handle || !dirty.size) return;
    const inStep = headsStr(handle.doc()) === appliedHeads;
    const writes = [];
    let restore = false;
    for (const s of dirty) {
      const spec = app.stores[s];
      const local = encodeLocalStore(spec);
      const had = Object.keys(shadow[s]).length;
      const ops = diffStore(shadow[s], local);
      shadow[s] = local;
      if (isMassRemoval(ops, had)) {
        if (!allowMassDelete) { restore = true; continue; }
        const n = b64url(crypto.getRandomValues(new Uint8Array(8)));
        clears[s] = encVal(n);
        writes.push([CLEAR_STORE, { creates: [[s, { n: encVal(n) }]], puts: [], removes: [] }]);
      }
      if (!emptyDiff(ops)) writes.push([s, ops]);
    }
    dirty.clear();
    allowMassDelete = false;
    if (writes.length) writeOps(handle, writes);
    // Only move the bookmark if nothing remote is waiting: restarting from a
    // bookmark that includes changes the app never adopted would read them as
    // local deletions.
    if (inStep) {
      appliedHeads = headsStr(handle.doc());
      saveState(handle.url);
    }
    if (restore) {
      console.warn('[aristeia sync] refused a mass delete with no explicit clear; restoring from the doc');
      appliedHeads = '';
      pull({ seed: true });
    }
  }

  function typingNow() {
    const el = document.activeElement;
    if (!el || !el.value) return false;
    return el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|range|file)$/.test(el.type) && !el.readOnly);
  }
  function isBusy() {
    if (typingNow() || document.querySelector('.visible[id$="-overlay"]')) return true;
    return !!(app.busy && app.busy());
  }

  function schedulePull() {
    if (pullTimer) return;
    pullTimer = setTimeout(() => { pullTimer = null; pull(); }, PULL_DELAY);
  }

  // What the doc holds now: everything, or just what changed since the bookmark.
  function readChanges(doc, heads) {
    const A = lib.Automerge;
    const next = {};
    for (const s of Object.keys(app.stores)) next[s] = Object.create(null);
    const fresh = {};
    const adopt = r => {
      if (r.store === CLEAR_STORE) {
        fresh[r.key] = r.enc.n;
      } else {
        // A field overwritten by something that doesn't open keeps its value.
        const had = shadow[r.store] && shadow[r.store][r.key];
        for (const f of Object.keys(had || {})) {
          if (r.forged.has(cipher.field(r.store, f))) r.enc[f] = had[f];
        }
        const n = normalizeRec(r.enc, app.stores[r.store]);
        if (n) next[r.store][r.key] = n;
        else delete next[r.store][r.key];
      }
    };
    const before = appliedHeads ? appliedHeads.split(',') : null;
    if (!before || !A.hasHeads(doc, before)) {
      for (const top of Object.keys(doc)) {
        const r = readRecord(doc[top], top, allStores, cipher, A);
        if (r) adopt(r);
      }
      return { next, fresh };
    }
    for (const s of Object.keys(app.stores)) Object.assign(next[s], shadow[s]);
    const tops = new Set(A.diff(doc, before, heads.split(',')).map(p => p.path[0]));
    let reverse = null; // hash → record, only worked out if something vanished
    for (const top of tops) {
      const r = doc[top] ? readRecord(doc[top], top, allStores, cipher, A) : null;
      if (r) { adopt(r); continue; }
      if (doc[top]) continue; // unreadable: forged, or another key's
      if (!reverse) {
        reverse = new Map();
        for (const s of Object.keys(app.stores)) for (const key of Object.keys(shadow[s])) reverse.set(cipher.top(s, key), [s, key]);
      }
      const gone = reverse.get(top);
      if (gone) delete next[gone[0]][gone[1]];
    }
    return { next, fresh };
  }

  function pull(opts = {}) {
    if (!handle) return;
    push();
    if (!opts.seed && isBusy()) { pendingPull = true; return; }
    const doc = handle.doc();
    const heads = headsStr(doc);
    if (heads === appliedHeads) { pendingPull = false; return; }
    pendingPull = false;
    const { next, fresh } = opts.read || readChanges(doc, heads);
    const changes = {};
    const heal = [];
    let any = false;
    applying = true;
    try {
      for (const [s, spec] of Object.entries(app.stores)) {
        const prev = shadow[s];
        let ops = diffStore(prev, next[s]);
        changes[s] = { added: [], changed: [], removed: [] };
        const cleared = fresh[s] !== undefined && fresh[s] !== clears[s];
        if (cleared) clears[s] = fresh[s];
        if (!opts.seed && !cleared && isMassRemoval(ops, Object.keys(prev).length)) {
          // Most of a store vanished and no device recorded a Clear: put it back.
          console.warn('[aristeia sync] the doc lost most of ' + s + ' with no clear recorded; restoring it');
          const creates = ops.removes.map(k => [k, prev[k]]);
          for (const [k, rec] of creates) next[s][k] = rec;
          heal.push([s, { creates, puts: [], removes: [] }]);
          ops = diffStore(prev, next[s]);
        }
        shadow[s] = next[s];
        if (emptyDiff(ops)) continue;
        any = true;
        changes[s].added = ops.creates.map(([, e]) => decodeRec(e, spec));
        changes[s].changed = ops.puts.map(([k]) => ({ old: decodeRec(prev[k], spec), rec: decodeRec(next[s][k], spec) }));
        changes[s].removed = ops.removes.map(k => decodeRec(prev[k], spec));
        spec.set(spec.clean(Object.values(next[s]).map(e => decodeRec(e, spec))));
      }
    } finally {
      applying = false;
    }
    if (heal.length) writeOps(handle, heal);
    appliedHeads = headsStr(handle.doc());
    saveState(handle.url);
    if (any && app.onChange) app.onChange(changes, { seed: !!opts.seed });
  }

  function start() {
    if (starting) return starting;
    const cfg = loadCfg();
    if (handle && (!cfg || cfg.root !== attachedRoot)) { // unpaired or re-paired in another tab
      location.reload();
      return Promise.resolve();
    }
    if (!cfg || handle || !app) { renderStatus(); return Promise.resolve(); }
    starting = (async () => {
      lastError = '';
      try {
        await ensureRepo(app.app);
        const url = await appDocUrl(cfg);
        const h = await findDoc(url);
        cipher = makeCipher(lib, rootKeyOf(cfg), app.app);
        attachedRoot = cfg.root;
        attach(h, url);
      } catch (e) {
        lastError = e && e.message ? e.message : String(e);
      }
    })().finally(() => { starting = null; renderStatus(); });
    renderStatus();
    return starting;
  }

  function flushNow() {
    push();
    if (repo && handle) repo.flush().catch(() => {});
  }

  function bindLifecycle() {
    window.addEventListener('online', () => start());
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flushNow();
      else start();
    });
    setInterval(() => { if (pendingPull) pull(); }, BUSY_POLL);
    setInterval(() => { if (loadCfg() && !attached && !starting) start(); }, RETRY_EVERY);
  }

  // ── Public API ─────────────────────────────────────────────────
  // A store's `read()` returns records with an `id`, `clean(records)` is the
  // app's sanitizer and must accept what read() returned, and `set(records)`
  // adopts clean records and persists them. Optional: `flatten` names fields
  // holding maps whose keys sync individually, `resolve` maps a field to a
  // function picking the winner among concurrent values.
  function register(spec) {
    app = spec;
    allStores = { ...spec.stores, [CLEAR_STORE]: { clean: r => r } };
    onStatus = spec.onStatus || null;
    bindLifecycle();
    renderStatus();
    return start();
  }

  function touch(store) {
    if (applying || !app || !app.stores[store]) return;
    dirty.add(store);
    if (!handle) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PUSH_DELAY);
  }

  // A store holding one settings object, with only `keys` synced. `adopt`
  // receives just the synced fields.
  function singleton(get, keys, adopt) {
    const pick = o => {
      const out = { id: '_' };
      for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
      return out;
    };
    return {
      read: () => [pick(get())],
      clean: recs => recs.filter(r => r.id === '_').slice(0, 1).map(pick),
      set: recs => { if (recs[0]) { const { id, ...rest } = recs[0]; adopt(rest); } },
    };
  }

  // ── Pairing, driven from the landing page ──────────────────────
  async function createPairing() {
    await ensureRepo('hub');
    const key = crypto.getRandomValues(new Uint8Array(32));
    const C = makeCipher(lib, key, 'root');
    const apps = {}, sealed = {};
    for (const a of APPS) {
      apps[a] = repo.create({ v: 1 }).url;
      const top = C.top('app', a);
      sealed[top] = C.seal([a, apps[a]], top, 'app');
    }
    const root = repo.create({ v: 1, apps: sealed });
    const prev = loadLS(CFG_KEY);
    saveLS(CFG_KEY, { root: root.url, key: b64url(key), apps, ...(prev && prev.server ? { server: prev.server } : {}) });
    await repo.flush();
    return hubStart();
  }
  // A sync link holds both the root doc's URL and the key.
  function parseLink(raw) {
    const m = String(raw || '').match(URL_RE), k = String(raw || '').match(KEY_RE);
    return m && k ? { root: m[0], key: k[1] } : null;
  }
  function joinPairing(raw) {
    const parsed = parseLink(raw);
    if (!parsed) throw new Error('That doesn\'t look like an aristeia sync link.');
    const prev = loadLS(CFG_KEY);
    saveLS(CFG_KEY, { ...parsed, ...(prev && prev.server ? { server: prev.server } : {}) });
    for (const a of APPS) localStorage.removeItem(STATE_PREFIX + a);
    return hubStart();
  }
  function stopPairing() {
    localStorage.removeItem(CFG_KEY);
    for (const a of APPS) localStorage.removeItem(STATE_PREFIX + a);
    attached = false;
    renderStatus();
  }
  function hubStart() {
    if (starting) return starting;
    const cfg = loadCfg();
    if (!cfg) { renderStatus(); return Promise.resolve(); }
    starting = (async () => {
      lastError = '';
      try {
        await ensureRepo('hub');
        const root = await findDoc(cfg.root);
        const apps = readRoot(root.doc(), makeCipher(lib, rootKeyOf(cfg), 'root'));
        if (!Object.keys(apps).length) throw new Error('this link\'s key doesn\'t open its sync data');
        cfg.apps = { ...apps };
        saveLS(CFG_KEY, cfg);
        attached = true;
        // Fetch every app's doc now, so an app first opened offline still has it.
        await Promise.allSettled(Object.values(apps).map(findDoc));
        await repo.flush();
      } catch (e) {
        lastError = e && e.message ? e.message : String(e);
      }
    })().finally(() => { starting = null; renderStatus(); });
    renderStatus();
    return starting;
  }
  function hub(handlers) {
    onStatus = handlers.onStatus || null;
    window.addEventListener('online', () => { if (!attached) hubStart(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !attached) hubStart(); });
    setInterval(() => { if (loadCfg() && !attached && !starting) hubStart(); }, RETRY_EVERY);
    renderStatus();
    return hubStart();
  }

  window.AristeiaSync = {
    register, touch, singleton, status,
    paired: () => !!loadCfg(),
    allowClear: () => { allowMassDelete = true; },
    hub, createPairing, joinPairing, stopPairing, parseLink,
    linkFragment: () => { const c = loadCfg(); return c ? 'sync=' + c.root + '&key=' + c.key : null; },
    rootUrl: () => { const c = loadCfg(); return c ? c.root : null; },
    _core: { encodeRec, decodeRec, encodeStore, diffStore, applyDiff, readDoc, readRecord, normalize, emptyDiff, makeCipher, digest, parseLink, stats },
  };
})();
