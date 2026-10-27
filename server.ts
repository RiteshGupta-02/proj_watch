import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.text({ type: ['text/plain', 'text/*'] }));

interface TelemetryData {
  bpm: number;
  spo2: number | null;
  wave: number;
  timestamp: number;
  raw?: string;
  source?: string;
  fingerDetected: boolean;
}

let latestTelemetry: TelemetryData = {
  bpm: 0,
  spo2: null,
  wave: 0.0,
  timestamp: 0,
  fingerDetected: false,
};

let lastPacketReceivedTime = 0;
let packetCount = 0;
const sseClients = new Set<Response>();

// Parse incoming telemetry payload whether it's JSON or ESP32 UDP string
function parsePayload(body: any, clientIp: string): TelemetryData {
  let bpm = 0;
  let spo2: number | null = null;
  let wave = 0.0;
  let rawStr = '';

  if (typeof body === 'string') {
    rawStr = body.trim();
    // Format: "BPM:72 SpO2:98 FILT:14.2" or "BPM:0 SpO2:None FILT:0.0"
    const bpmMatch = rawStr.match(/BPM[:\s=]+(\d+)/i);
    const spo2Match = rawStr.match(/SpO2[:\s=]+(\d+|None|null)/i);
    const filtMatch = rawStr.match(/(?:FILT|WAVE)[:\s=]+(-?[\d.]+)/i);

    if (bpmMatch) bpm = parseInt(bpmMatch[1], 10);
    if (spo2Match) {
      const val = spo2Match[1];
      spo2 = val === 'None' || val === 'null' ? null : parseInt(val, 10);
    }
    if (filtMatch) wave = parseFloat(filtMatch[1]);
  } else if (typeof body === 'object' && body !== null) {
    bpm = Number(body.bpm) || 0;
    if (body.spo2 !== undefined && body.spo2 !== null && body.spo2 !== 'None') {
      spo2 = Number(body.spo2);
    }
    wave = Number(body.wave ?? body.filt ?? body.ac_f) || 0.0;
    rawStr = JSON.stringify(body);
  }

  const fingerDetected = (spo2 !== null && spo2 > 0) || bpm > 0 || Math.abs(wave) > 2;

  return {
    bpm,
    spo2,
    wave: Number.isFinite(wave) ? Number(wave.toFixed(2)) : 0,
    timestamp: Date.now(),
    raw: rawStr,
    source: clientIp,
    fingerDetected,
  };
}

// Ingest endpoint for ESP32 / Python bridge
app.post('/api/telemetry', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const data = parsePayload(req.body, clientIp);

  latestTelemetry = data;
  lastPacketReceivedTime = Date.now();
  packetCount++;

  // Broadcast to all active SSE subscribers
  const ssePayload = `event: telemetry\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(ssePayload);
    } catch {
      sseClients.delete(client);
    }
  }

  res.status(200).json({ status: 'ok', packetsReceived: packetCount });
});

// SSE endpoint for live streaming to browser clients
app.get('/api/telemetry/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial state
  const isConnected = Date.now() - lastPacketReceivedTime < 3500;
  res.write(
    `event: init\ndata: ${JSON.stringify({
      latest: latestTelemetry,
      connected: isConnected,
      lastSeen: lastPacketReceivedTime,
      packetCount,
    })}\n\n`
  );

  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 5000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Status endpoint
app.get('/api/status', (_req: Request, res: Response) => {
  const isConnected = Date.now() - lastPacketReceivedTime < 3500;
  res.json({
    connected: isConnected,
    lastSeen: lastPacketReceivedTime,
    packetCount,
    latestTelemetry,
  });
});

// Dynamic Python Bridge Generator endpoint
app.get('/api/scripts/bridge.py', (req: Request, res: Response) => {
  const hostUrl = `${req.protocol}://${req.get('host')}`;
  const scriptContent = `#!/usr/bin/env python3
"""
ESP32 Vital Signs UDP to Web Dashboard Bridge
---------------------------------------------
This script listens on UDP port 5005 for telemetry packets sent by your ESP32
(e.g., "BPM:72 SpO2:98 FILT:14.2") and relays them to your web dashboard at:
${hostUrl}/api/telemetry

Usage:
    python bridge.py
Optional arguments:
    --port 5005
    --url ${hostUrl}/api/telemetry
"""

import socket
import sys
import json
import argparse
import urllib.request
import urllib.error
import time

def main():
    parser = argparse.ArgumentParser(description="Relay ESP32 UDP packets to Web App")
    parser.add_argument("--port", type=int, default=5005, help="Local UDP port to listen on (default: 5005)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Local host binding (default: 0.0.0.0)")
    parser.add_argument("--url", type=str, default="${hostUrl}/api/telemetry", help="Target Web App API URL")
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind((args.host, args.port))
        print(f"[READY] Listening for ESP32 UDP packets on {args.host}:{args.port}...")
        print(f"[TARGET] Forwarding to {args.url}")
        print("Waiting for data from ESP32 MAX30102 sensor...")
    except Exception as e:
        print(f"[ERROR] Failed to bind to port {args.port}: {e}")
        sys.exit(1)

    packet_num = 0
    while True:
        try:
            data, addr = sock.recvfrom(1024)
            line = data.decode("utf-8", errors="replace").strip()
            packet_num += 1
            print(f"[{packet_num}] From {addr[0]}: {line}")

            # Send HTTP POST to dashboard
            req = urllib.request.Request(
                args.url,
                data=line.encode("utf-8"),
                headers={"Content-Type": "text/plain"}
            )
            try:
                with urllib.request.urlopen(req, timeout=1.0) as resp:
                    pass
            except Exception as http_err:
                # Do not crash loop on momentary network timeouts
                print(f"  -> Forward warning: {http_err}")

        except KeyboardInterrupt:
            print("\\n[STOPPED] Exiting bridge.")
            break
        except Exception as e:
            print(f"[WARN] Error reading packet: {e}")
            time.sleep(0.05)

if __name__ == "__main__":
    main()
`;
  res.setHeader('Content-Type', 'text/x-python');
  res.setHeader('Content-Disposition', 'attachment; filename="esp32_bridge.py"');
  res.send(scriptContent);
});

// Vite or Static files handling
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
