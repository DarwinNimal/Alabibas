// On your user pages (while logged in), add before </body>:  <script src="/admin/chat-widget.js"></script>
(() => {
  const API = '/admin/chat_api.php';
  const box = document.createElement('div');
  box.innerHTML = `<style>
   #cw-btn{position:fixed;right:18px;bottom:18px;z-index:9999;background:#111;color:#fff;border:0;border-radius:24px;padding:12px 18px;cursor:pointer;font:600 14px system-ui}
   #cw{position:fixed;right:18px;bottom:70px;width:320px;max-width:calc(100vw - 36px);height:420px;background:#fff;border:1px solid #ddd;border-radius:10px;display:none;flex-direction:column;z-index:9999;font:14px system-ui;box-shadow:0 8px 30px #0003}
   #cw header{padding:12px;background:#111;color:#fff;border-radius:10px 10px 0 0;font-weight:600}
   #cw-msgs{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:6px}
   .cw-m{max-width:80%;padding:7px 10px;border-radius:12px;background:#eee;align-self:flex-start;word-wrap:break-word}.cw-m.me{background:#111;color:#fff;align-self:flex-end}
   #cw form{display:flex;border-top:1px solid #ddd}#cw input{flex:1;border:0;padding:12px;font:inherit;outline:none}#cw form button{border:0;background:none;padding:0 14px;font-weight:600;cursor:pointer}</style>
  <button id="cw-btn">Chat with seller</button>
  <div id="cw"><header>Chat with Alabibas</header><div id="cw-msgs"></div><form><input placeholder="Type a message..." maxlength="2000"><button>Send</button></form></div>`;
  document.body.appendChild(box);
  const $ = q => box.querySelector(q), list = $('#cw-msgs'); let last = 0, timer = null;
  const add = m => { const d = document.createElement('div'); d.className = 'cw-m' + (m.sender === 'customer' ? ' me' : ''); d.textContent = m.text; list.appendChild(d); last = Math.max(last, +m.id); list.scrollTop = list.scrollHeight; };
  const poll = async () => { try { const r = await fetch(`${API}?action=messages&after=${last}`); if (r.ok) (await r.json()).forEach(add); else if (r.status === 401 && !last) list.innerHTML = '<p style="color:#666">Please log in to chat with the seller.</p>'; } catch (e) {} };
  $('#cw-btn').onclick = () => { const w = $('#cw'), open = w.style.display !== 'flex'; w.style.display = open ? 'flex' : 'none'; clearInterval(timer); if (open) { poll(); timer = setInterval(poll, 3000); } };
  $('form').onsubmit = async e => { e.preventDefault(); const i = $('input'), t = i.value.trim(); if (!t) return; i.value = '';
    await fetch(`${API}?action=send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) }); poll(); };
})();
