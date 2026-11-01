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
// Doc layout: flat top-level keys `<store>/<recordId>`, each a map of fields.
// There are no parent maps to create, because two devices creating the same
// parent offline would conflict and one side's whole subtree would vanish.
// Values are numbers, booleans, null, or immutable JSON strings, so a field is
// an atomic register, not a character-merged text.
(() => {
  'use strict';

  const CFG_KEY = 'aristeia_sync';
  const STATE_PREFIX = 'aristeia_sync_state_';
  const BASE = new URL('./', document.currentScript ? document.currentScript.src : location.href).href;
  const LIB = BASE + 'vendor/automerge.js';
  const WASM = BASE + 'vendor/automerge.wasm';
  // Automerge's public test server: no account or VPN needed on any device, but
  // docs are stored there unencrypted, readable by anyone holding a doc's link,
  // and it promises to keep nothing. Every device holds a full copy regardless.
  const DEFAULT_SERVER = 'wss://sync.automerge.org';
  const APPS = ['meridian', 'gnomon', 'pharmakon', 'halteres', 'nbacking', 'peira', 'kleio'];
  const URL_RE = /automerge:[1-9A-HJ-NP-Za-km-z]+/;
  const PUSH_DELAY = 300;
  const PULL_DELAY = 150;
  const BUSY_POLL = 2000;
  const RETRY_EVERY = 30000;
  const FIND_TIMEOUT = 20000;
  // A save that would drop this much of a store is treated as lost local data
  // (a failed read, evicted localStorage) unless the app said it meant it.
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
  const encFromDoc = v => (v && typeof v === 'object' && typeof v.val === 'string' ? v.val : v);

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

  function applyDiff(d, store, ops, Imm) {
    const toDoc = e => (typeof e === 'string' ? new Imm(e) : e);
    for (const [key, rec] of ops.creates) {
      const k = store + '/' + key;
      if (d[k]) { // another device got there first: the record is shared now
        for (const f of Object.keys(rec)) if (encFromDoc(d[k][f]) !== rec[f]) d[k][f] = toDoc(rec[f]);
        continue;
      }
      const obj = {};
      for (const f of Object.keys(rec)) obj[f] = toDoc(rec[f]);
      d[k] = obj;
    }
    for (const [key, set, del] of ops.puts) {
      const r = d[store + '/' + key];
      if (!r) continue; // deleted elsewhere: a delete beats a concurrent edit
      for (const f of Object.keys(set)) r[f] = toDoc(set[f]);
      for (const f of del) delete r[f];
    }
    for (const key of ops.removes) delete d[store + '/' + key];
  }

  // Doc → { store: { key: encRec } }, running each conflicted field with a
  // resolver through it. A resolver only ever sees concurrent writes (a write
  // made after seeing another simply replaces it) and must be deterministic.
  function readDoc(doc, stores, A) {
    const out = {};
    for (const s of Object.keys(stores)) out[s] = Object.create(null);
    for (const k of Object.keys(doc)) {
      const slash = k.indexOf('/');
      if (slash < 0) continue;
      const s = k.slice(0, slash);
      if (!out[s]) continue;
      const raw = doc[k], spec = stores[s], enc = {};
      for (const f of Object.keys(raw)) {
        enc[f] = encFromDoc(raw[f]);
        const fn = spec.resolve && spec.resolve[f];
        if (!fn) continue;
        const c = A.getConflicts(raw, f);
        const ids = c ? Object.keys(c).sort() : [];
        if (ids.length > 1) enc[f] = encVal(fn(ids.map(id => decVal(encFromDoc(c[id])))));
      }
      out[s][k.slice(slash + 1)] = enc;
    }
    return out;
  }

  // What the app would hold if it adopted these records.
  const normalize = (encMap, spec) => encodeStore(spec.clean(Object.values(encMap).map(e => decodeRec(e, spec))), spec);

  // ── Pairing config ─────────────────────────────────────────────
  function loadLS(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function saveLS(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }
  function loadCfg() {
    const c = loadLS(CFG_KEY);
    return c && typeof c === 'object' && typeof c.root === 'string' ? c : null;
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
  let attachedRoot = null;
  let shadow = {};       // store → last synced enc map
  let appliedHeads = ''; // doc heads that `shadow` and app state reflect
  let applying = false;
  let allowMassDelete = false;
  let pendingPull = false;
  const dirty = new Set();
  let pushTimer = null, pullTimer = null;

  const headsStr = doc => lib.Automerge.getHeads(doc).join(',');
  function encodeLocal() {
    const out = {};
    for (const [s, spec] of Object.entries(app.stores)) out[s] = encodeStore(spec.read(), spec);
    return out;
  }
  function saveState(url) {
    saveLS(STATE_PREFIX + app.app, { url, heads: appliedHeads.split(',') });
  }

  async function appDocUrl(cfg) {
    if (cfg.apps && cfg.apps[app.app]) return cfg.apps[app.app];
    const root = await findDoc(cfg.root);
    let url = root.doc().apps && root.doc().apps[app.app];
    if (!url) { // an app newer than the pairing
      url = repo.create({ v: 1 }).url;
      root.change(d => { if (!d.apps) d.apps = {}; d.apps[app.app] = url; });
      url = root.doc().apps[app.app];
    }
    cfg.apps = { ...(cfg.apps || {}), [app.app]: url };
    saveLS(CFG_KEY, cfg);
    return url;
  }

  function attach(h, url) {
    const A = lib.Automerge;
    const doc = h.doc();
    const st = loadLS(STATE_PREFIX + app.app);
    const known = st && st.url === url && Array.isArray(st.heads) && st.heads[0] && A.hasHeads(doc, st.heads);
    const local = encodeLocal();
    let restoring = !known;
    const inDoc = readDoc(doc, app.stores, A);
    const writes = [];
    if (known) {
      // Anything the app changed since it last synced, including while closed.
      const baseDoc = st.heads.join(',') === headsStr(doc) ? doc : A.view(doc, st.heads);
      const baseRaw = readDoc(baseDoc, app.stores, A);
      for (const [s, spec] of Object.entries(app.stores)) {
        const ops = diffStore(normalize(baseRaw[s], spec), local[s]);
        if (looksLikeDataLoss(ops, Object.keys(baseRaw[s]).length)) { restoring = true; continue; }
        if (!emptyDiff(ops)) writes.push([s, ops]);
      }
    } else {
      // First contact (or the bookmark was lost): merge in what the doc lacks,
      // and otherwise adopt the doc.
      for (const s of Object.keys(app.stores)) {
        const creates = Object.keys(local[s]).filter(k => !inDoc[s][k]).map(k => [k, local[s][k]]);
        if (creates.length) writes.push([s, { creates, puts: [], removes: [] }]);
      }
    }
    if (writes.length) h.change(d => { for (const [s, ops] of writes) applyDiff(d, s, ops, lib.ImmutableString); });
    handle = h;
    shadow = local;
    appliedHeads = '';
    attached = true;
    h.on('change', schedulePull);
    pull({ seed: restoring });
    if (['gnomon', 'pharmakon'].includes(app.app)) { // the old per-app prototypes
      localStorage.removeItem(app.app + '_sync');
      try { indexedDB.deleteDatabase(app.app + '-sync'); } catch (e) {}
    }
  }

  function looksLikeDataLoss(ops, had) {
    return !allowMassDelete && ops.removes.length >= MASS_DELETE_MIN && ops.removes.length * 2 > had;
  }

  function push() {
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    if (!handle || !dirty.size) return;
    const inStep = headsStr(handle.doc()) === appliedHeads;
    const writes = [];
    let restore = false;
    for (const s of dirty) {
      const spec = app.stores[s];
      const local = encodeStore(spec.read(), spec);
      const ops = diffStore(shadow[s], local);
      shadow[s] = local;
      if (looksLikeDataLoss(ops, Object.keys(shadow[s]).length + ops.removes.length)) { restore = true; continue; }
      if (!emptyDiff(ops)) writes.push([s, ops]);
    }
    dirty.clear();
    allowMassDelete = false;
    if (writes.length) handle.change(d => { for (const [s, ops] of writes) applyDiff(d, s, ops, lib.ImmutableString); });
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

  function pull(opts = {}) {
    if (!handle) return;
    push();
    if (!opts.seed && isBusy()) { pendingPull = true; return; }
    const doc = handle.doc();
    const heads = headsStr(doc);
    if (heads === appliedHeads) { pendingPull = false; return; }
    pendingPull = false;
    const raw = readDoc(doc, app.stores, lib.Automerge);
    const changes = {};
    let any = false;
    applying = true;
    try {
      for (const [s, spec] of Object.entries(app.stores)) {
        const next = normalize(raw[s], spec);
        const prev = shadow[s];
        const ops = diffStore(prev, next);
        shadow[s] = next;
        changes[s] = { added: [], changed: [], removed: [] };
        if (emptyDiff(ops)) continue;
        any = true;
        changes[s].added = ops.creates.map(([, e]) => decodeRec(e, spec));
        changes[s].changed = ops.puts.map(([k]) => ({ old: decodeRec(prev[k], spec), rec: decodeRec(next[k], spec) }));
        changes[s].removed = ops.removes.map(k => decodeRec(prev[k], spec));
        spec.set(spec.clean(Object.values(raw[s]).map(e => decodeRec(e, spec))));
      }
    } finally {
      applying = false;
    }
    appliedHeads = heads;
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
    const apps = {};
    for (const a of APPS) apps[a] = repo.create({ v: 1 }).url;
    const root = repo.create({ v: 1, apps });
    const prev = loadLS(CFG_KEY);
    saveLS(CFG_KEY, { root: root.url, apps, ...(prev && prev.server ? { server: prev.server } : {}) });
    await repo.flush();
    return hubStart();
  }
  function parseLink(raw) {
    const m = String(raw || '').match(URL_RE);
    return m ? m[0] : null;
  }
  function joinPairing(raw) {
    const url = parseLink(raw);
    if (!url) throw new Error('That doesn\'t look like an aristeia sync link.');
    const prev = loadLS(CFG_KEY);
    saveLS(CFG_KEY, { root: url, ...(prev && prev.server ? { server: prev.server } : {}) });
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
        const apps = (root.doc() && root.doc().apps) || {};
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
    rootUrl: () => { const c = loadCfg(); return c ? c.root : null; },
    _core: { encodeRec, decodeRec, encodeStore, diffStore, applyDiff, readDoc, normalize, emptyDiff },
  };
})();
