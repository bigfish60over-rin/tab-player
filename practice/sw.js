// 練習プレーヤーのサービスワーカー（アプリの部品をスマホの中に置いて、電波がなくても開けるようにする）
// - 置くのはアプリの部品（ページ・設定・アイコン）だけ。曲のファイルは置かない
// - 新しい版（VERSION が変わる）が出ると、裏で新しい部品を用意し、ページの「更新する」で切り替える
// - 「共有」で受け取った曲は、ページに渡すまでの間だけ覚えておき、渡したらすぐ忘れる（保存しない）
"use strict";
const VERSION = "2.0.1";
const CACHE = "practice-" + VERSION;
const FILES = ["./", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-maskable-512.png", "./icons/favicon-64.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("practice-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

let shared = null;      // 共有で受け取った曲（メモリの中だけ）
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  else if (e.data === "VERSION") e.source.postMessage({ type: "VERSION", version: VERSION });
  else if (e.data === "GET_SHARED") { e.source.postMessage({ type: "SHARED", file: shared }); shared = null; }
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.pathname.endsWith("/share")) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const f = fd.getAll("audio").find(x => x instanceof File) || null;
        shared = f;
      } catch (err) { shared = null; }
      return Response.redirect(new URL("./?shared=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(e.request); }
    catch (err) {
      if (e.request.mode === "navigate") { const page = await c.match("./"); if (page) return page; }
      throw err;
    }
  })());
});
