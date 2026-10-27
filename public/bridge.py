#!/usr/bin/env python3
"""
====================================================================
ESP32 MAX30102 Vital Signs -> Web Dashboard UDP Bridge
====================================================================
This script runs on your computer (IP: 172.26.135.152 or any local IP)
and listens on UDP port 5005 for the packets sent by your ESP32:
    line = "BPM:%d SpO2:%s FILT:%.1f" % (bpm, spo2, ac_f)
    sock.sendto(line.encode(), DEST)

It parses the data and relays it in real-time to your Web Dashboard.

Requirements:
    Python 3.x (no extra third-party pip packages needed; uses built-in socket & urllib)

Usage:
    python bridge.py
"""

import socket
import sys
import time
import argparse
import urllib.request
import urllib.error

DEFAULT_PORT = 5005
DEFAULT_HOST = "0.0.0.0"
# Replace with your app URL if running remotely, or pass via --url
DEFAULT_URL = "https://ais-dev-l3yyi56pasnzbulhqyacxr-373303208508.asia-east1.run.app/api/telemetry"

def main():
    parser = argparse.ArgumentParser(description="ESP32 UDP Telemetry to Web Dashboard Bridge")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Local UDP port (default: 5005)")
    parser.add_argument("--host", type=str, default=DEFAULT_HOST, help="Host interface (default: 0.0.0.0)")
    parser.add_argument("--url", type=str, default=DEFAULT_URL, help="Target Web Ingest URL")
    args = parser.parse_args()

    print("=" * 65)
    print("   ESP32 MAX30102 TELEMETRY BRIDGE - PYTHON RELAY")
    print("=" * 65)
    print(f"[*] Binding UDP Socket on: {args.host}:{args.port}")
    print(f"[*] Forwarding target URL: {args.url}")
    print("-" * 65)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind((args.host, args.port))
        print(f"[OK] Listening on UDP port {args.port}...")
        print("[*] Waiting for incoming packets from ESP32...")
    except Exception as e:
        print(f"[ERROR] Could not bind to port {args.port}: {e}")
        print("[TIP] Make sure no other process or terminal is using port 5005.")
        sys.exit(1)

    packet_count = 0
    while True:
        try:
            data, addr = sock.recvfrom(1024)
            line = data.decode("utf-8", errors="replace").strip()
            packet_count += 1
            print(f"[{packet_count:05d}] From {addr[0]}:{addr[1]} -> {line}")

            # Send HTTP POST to the Web Dashboard
            req = urllib.request.Request(
                args.url,
                data=line.encode("utf-8"),
                headers={"Content-Type": "text/plain"}
            )
            try:
                with urllib.request.urlopen(req, timeout=1.2) as resp:
                    pass
            except Exception as http_err:
                print(f"       -> Relay Warning: {http_err}")

        except KeyboardInterrupt:
            print("\n[STOP] Exiting bridge...")
            break
        except Exception as e:
            print(f"[WARN] Error reading packet: {e}")
            time.sleep(0.05)

if __name__ == "__main__":
    main()
