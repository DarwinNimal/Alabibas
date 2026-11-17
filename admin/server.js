const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);

require('./admin-module')(app, server);          // <-- the only line you need in YOUR existing server
app.use(express.static('public'));                // your existing user-side files

server.listen(process.env.PORT || 3000, () => console.log('Running'));
