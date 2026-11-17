/*
  ALABIBAS live chat (customer side)
  ----------------------------------
  Add this line before </body> on every customer page:
      <script src="chat.js"></script>

  It uses the same localStorage keys as admin.html:
      "alabibasUser"  -> the logged-in customer (set by login.html)
      "alabibasAdmin" -> the logged-in admin    (set by login.html)
      "alabibasChats" -> every conversation, keyed by the customer's email

  NOTE: front-end demo. Customer and admin only see each other when they use
  the SAME browser (e.g. two tabs). For a real store, move getChats() /
  saveChats() to a server (PHP + MySQL, or a service like Firebase).
*/
(function () {
  var USER_KEY  = "alabibasUser";
  var ADMIN_KEY = "alabibasAdmin";
  var CHATS_KEY = "alabibasChats";
  var OPEN_KEY  = "alabibasChatOpen";
  var MAX_LEN   = 500;
  var MAX_MSGS  = 200;

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function getChats() {
    var c = read(CHATS_KEY);
    return c && typeof c === "object" ? c : {};
  }
  function saveChats(chats) {
    try { localStorage.setItem(CHATS_KEY, JSON.stringify(chats)); return true; }
    catch (e) { return false; }
  }

  // admins use admin.html, so they don't get the customer chat box
  if (read(ADMIN_KEY)) return;

  /* ---------- styles ---------- */
  var css = [
    "#ab-chat-btn{position:fixed;right:20px;bottom:20px;z-index:50;width:58px;height:58px;border:0;border-radius:50%;background:#a36233;color:#fff;cursor:pointer;box-shadow:0 3px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-family:inherit}",
    "#ab-chat-btn:hover{background:#8a5630}",
    "#ab-chat-btn svg{width:28px;height:28px}",
    "#ab-chat-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#b3261e;color:#fff;font-size:.68rem;font-weight:600;line-height:20px;text-align:center}",
    "#ab-chat-badge[hidden]{display:none}",
    "#ab-chat-panel{position:fixed;right:20px;bottom:90px;z-index:50;width:340px;max-width:calc(100vw - 24px);height:460px;max-height:calc(100vh - 110px);display:flex;flex-direction:column;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.35);font-family:'Poppins',Arial,sans-serif;color:#000}",
    "#ab-chat-panel[hidden]{display:none}",
    "#ab-chat-panel *{box-sizing:border-box}",
    ".ab-head{background:#b0b998;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}",
    ".ab-head strong{display:block;font-size:.95rem;font-weight:600}",
    ".ab-head small{font-size:.7rem;opacity:.95}",
    ".ab-close{background:none;border:0;color:#fff;font-size:1.5rem;line-height:1;cursor:pointer;padding:0 4px}",
    ".ab-msgs{flex:1;overflow-y:auto;padding:14px;background:#fbf8f1;display:flex;flex-direction:column;gap:8px}",
    ".ab-row{display:flex;flex-direction:column;max-width:80%}",
    ".ab-row.me{align-self:flex-end;align-items:flex-end}",
    ".ab-row.them{align-self:flex-start;align-items:flex-start}",
    ".ab-bubble{padding:8px 13px;border-radius:14px;font-size:.82rem;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".ab-row.me .ab-bubble{background:#a36233;color:#fff;border-bottom-right-radius:4px}",
    ".ab-row.them .ab-bubble{background:#f8f0de;border-bottom-left-radius:4px}",
    ".ab-stamp{font-size:.6rem;color:#777;margin-top:2px}",
    ".ab-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #eee6d3;background:#fff}",
    ".ab-form input{flex:1;min-width:0;height:38px;border:1px solid #b0b998;border-radius:999px;padding:0 14px;font:inherit;font-size:.82rem;outline:none}",
    ".ab-form input:focus{border-color:#a36233}",
    ".ab-form button{border:0;border-radius:999px;background:#a36233;color:#fff;padding:0 18px;font:inherit;font-size:.82rem;cursor:pointer}",
    ".ab-form button:hover{background:#8a5630}",
    ".ab-login{margin:auto;text-align:center;padding:20px;font-size:.85rem;line-height:1.6;background:#fbf8f1;flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:14px}",
    ".ab-login a{display:inline-block;background:#a36233;color:#fff;border-radius:999px;padding:9px 26px;font-size:.85rem;font-weight:600}",
    ".ab-login a:hover{background:#8a5630}",
    "#ab-chat-btn:focus-visible,.ab-close:focus-visible,.ab-form button:focus-visible,.ab-login a:focus-visible,.ab-form input:focus-visible{outline:2px solid #000;outline-offset:2px}",
    "@media (max-width:480px){#ab-chat-panel{right:12px;bottom:84px}#ab-chat-btn{right:12px;bottom:14px}}"
  ].join("\n");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function fmtTime(ts) {
    var d = new Date(ts), h = d.getHours(), m = d.getMinutes();
    var ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + (m < 10 ? "0" : "") + m + " " + ap;
  }
  function fmtStamp(ts) {
    var d = new Date(ts);
    if (d.toDateString() === new Date().toDateString()) return fmtTime(ts);
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) + ", " + fmtTime(ts);
  }
  function currentUser() {
    var u = read(USER_KEY);
    return u && u.email ? u : null;
  }
  function myConv() {
    var u = currentUser();
    if (!u) return null;
    var c = getChats()[u.email.toLowerCase()];
    return c && c.messages ? c : null;
  }
  function unreadCount() {
    var c = myConv();
    if (!c) return 0;
    var seen = c.userSeen || 0, n = 0;
    c.messages.forEach(function (m) { if (m.from === "admin" && m.ts > seen) n++; });
    return n;
  }
  function markSeen() {
    var u = currentUser();
    if (!u) return;
    var key = u.email.toLowerCase();
    var chats = getChats();
    var c = chats[key];
    if (!c || unreadCount() === 0) return;
    c.userSeen = Date.now();
    saveChats(chats);
  }

  /* ---------- build the widget ---------- */
  var btn = el("button");
  btn.id = "ab-chat-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
  var badge = el("span");
  badge.id = "ab-chat-badge";
  badge.hidden = true;
  btn.appendChild(badge);

  var panel = el("section");
  panel.id = "ab-chat-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Chat with ALABIBAS");

  var head = el("div", "ab-head");
  var headInfo = el("div");
  headInfo.appendChild(el("strong", "", "Chat with ALABIBAS"));
  headInfo.appendChild(el("small", "", "Support hours: 8AM \u2013 5PM"));
  var closeBtn = el("button", "ab-close", "\u00d7");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close chat");
  head.appendChild(headInfo);
  head.appendChild(closeBtn);

  var body = el("div");              // swapped between login prompt and chat
  body.style.cssText = "display:flex;flex-direction:column;flex:1;min-height:0";

  panel.appendChild(head);
  panel.appendChild(body);
  document.body.appendChild(panel);
  document.body.appendChild(btn);

  var msgsEl = null, form = null, input = null;
  var mode = "";                     // "login" or "chat", so we only rebuild when it changes

  function pageName() {
    var p = location.pathname.split("/").pop();
    return p || "index.html";
  }

  function buildLogin() {
    body.innerHTML = "";
    var box = el("div", "ab-login");
    box.appendChild(el("p", "", "Please log in to chat with our team. It only takes a moment."));
    var a = el("a", "", "Login / Register");
    a.href = "login.html?next=" + encodeURIComponent(pageName());
    box.appendChild(a);
    body.appendChild(box);
    msgsEl = form = input = null;
    mode = "login";
  }

  function buildChat() {
    body.innerHTML = "";
    msgsEl = el("div", "ab-msgs");
    msgsEl.setAttribute("aria-live", "polite");
    form = el("form", "ab-form");
    input = el("input");
    input.type = "text";
    input.maxLength = MAX_LEN;
    input.placeholder = "Type your message...";
    input.setAttribute("aria-label", "Your message");
    input.autocomplete = "off";
    var send = el("button", "", "Send");
    send.type = "submit";
    form.appendChild(input);
    form.appendChild(send);
    body.appendChild(msgsEl);
    body.appendChild(form);
    form.addEventListener("submit", onSend);
    mode = "chat";
  }

  function renderMessages(forceBottom) {
    if (!msgsEl) return;
    var near = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 60;
    msgsEl.innerHTML = "";

    var c = myConv();
    var u = currentUser();
    var list = c ? c.messages : [];

    if (!list.length) {
      var hello = el("div", "ab-row them");
      hello.appendChild(el("div", "ab-bubble", "Hi" + (u && u.name ? ", " + u.name : "") + "! How can we help you today?"));
      msgsEl.appendChild(hello);
    }

    list.forEach(function (m) {
      var row = el("div", "ab-row " + (m.from === "user" ? "me" : "them"));
      row.appendChild(el("div", "ab-bubble", m.text));          // textContent: safe from HTML injection
      row.appendChild(el("span", "ab-stamp", fmtStamp(m.ts) + (m.from === "admin" ? " \u00b7 ALABIBAS" : "")));
      msgsEl.appendChild(row);
    });

    if (forceBottom || near) msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function onSend(e) {
    e.preventDefault();
    var text = input.value.trim().slice(0, MAX_LEN);
    var u = currentUser();
    if (!text || !u) return;

    var key = u.email.toLowerCase();
    var chats = getChats();
    var c = chats[key] || (chats[key] = { name: u.name || key, messages: [], adminSeen: 0 });
    c.name = u.name || c.name || key;
    c.messages.push({ from: "user", text: text, ts: Date.now() });
    if (c.messages.length > MAX_MSGS) c.messages = c.messages.slice(-MAX_MSGS);
    c.userSeen = Date.now();

    if (!saveChats(chats)) {
      alert("Your browser blocked saving the message. Please check its storage settings.");
      return;
    }
    input.value = "";
    renderMessages(true);
  }

  function updateBadge() {
    var n = panel.hidden ? unreadCount() : 0;
    badge.hidden = n === 0;
    badge.textContent = n > 9 ? "9+" : String(n);
  }

  function sync(forceBottom) {
    var want = currentUser() ? "chat" : "login";
    if (want !== mode) { want === "chat" ? buildChat() : buildLogin(); forceBottom = true; }
    if (!panel.hidden && mode === "chat") { markSeen(); renderMessages(forceBottom); }
    updateBadge();
  }

  function setOpen(open) {
    panel.hidden = !open;
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    try { sessionStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch (e) {}
    sync(true);
    if (open && input) input.focus();
  }

  btn.addEventListener("click", function () { setOpen(panel.hidden); });
  closeBtn.addEventListener("click", function () { setOpen(false); btn.focus(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) { setOpen(false); btn.focus(); }
  });

  /* ---------- live updates ---------- */
  var lastSig = "";
  function signature() {
    var c = myConv(), u = currentUser();
    var m = c ? c.messages : [];
    return (u ? u.email : "") + ":" + m.length + ":" + (m.length ? m[m.length - 1].ts : 0) + ":" + (c ? c.userSeen || 0 : 0) + ":" + panel.hidden;
  }
  function tick() {
    if (read(ADMIN_KEY)) { panel.hidden = true; btn.hidden = true; return; }   // an admin just logged in
    var sig = signature();
    if (sig === lastSig) return;
    lastSig = sig;
    sync(false);
  }
  window.addEventListener("storage", function (e) {
    if (e.key === CHATS_KEY || e.key === USER_KEY || e.key === ADMIN_KEY || e.key === null) tick();
  });
  setInterval(tick, 2000);

  /* ---------- start ---------- */
  var wasOpen = false;
  try { wasOpen = sessionStorage.getItem(OPEN_KEY) === "1"; } catch (e) {}
  setOpen(wasOpen);
  lastSig = signature();
})();
