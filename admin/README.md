# Alabibas admin

## Setup
1. Copy `admin-module.js`, `public/admin/`, and `public/chat-widget.js` into your project; `npm i better-sqlite3 express socket.io`.
2. In your existing server, create the http server and add ONE line:
   `const server = require('http').createServer(app); require('./admin-module')(app, server); server.listen(PORT)`
   (use `server.listen`, not `app.listen`, or the chat won't work).
3. Railway variables: `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_SECRET` (long random string), `DB_PATH` (use a Railway Volume path, e.g. `/data/alabibas.db`, so data survives redeploys).
4. Edit `getCustomer()` in `admin-module.js` to return `{id, name}` from YOUR login session.
5. On user pages add before </body>:
   `<script src="/socket.io/socket.io.js"></script><script src="/chat-widget.js"></script>`
6. In your checkout, call `app.locals.recordSale(productId, qty)`; it returns false if stock ran out.

Admin: `/admin/` (redirects to `/admin/login.html` when logged out).
Test locally: `npm i && npm start`, then visit `/admin/login.html` (default admin / 12345).
