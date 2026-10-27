import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, Radio, Server, Cpu } from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  isOpen,
  onClose,
  appUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'bridge' | 'esp32_udp' | 'mqtt'>('bridge');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentHostUrl = typeof window !== 'undefined' ? window.location.origin : appUrl;
  const ingestEndpoint = `${currentHostUrl}/api/telemetry`;

  const bridgeScript = `#!/usr/bin/env python3
"""
====================================================================
ESP32 MAX30102 Vital Signs -> Web Dashboard UDP Bridge
====================================================================
This script listens on UDP port 5005 for the telemetry packets sent
by your ESP32 (e.g. "BPM:72 SpO2:98 FILT:14.2") and forwards them
instantly to your Web Dashboard:
${ingestEndpoint}
"""

import socket
import sys
import time
import urllib.request
import urllib.error

# UDP Configuration matching your ESP32
UDP_IP = "0.0.0.0"       # Listen on all local network interfaces
UDP_PORT = 5005          # Port configured in your ESP32 DEST = ("172.26.135.152", 5005)
WEB_URL = "${ingestEndpoint}"

def main():
    print("=" * 60)
    print("  ESP32 MAX30102 TELEMETRY BRIDGE")
    print("=" * 60)
    print(f"[*] Binding UDP Socket to {UDP_IP}:{UDP_PORT}...")
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind((UDP_IP, UDP_PORT))
        print(f"[+] UDP Listener active on port {UDP_PORT}")
        print(f"[+] Forwarding telemetry to: {WEB_URL}")
        print("[*] Waiting for incoming packets from ESP32...")
        print("-" * 60)
    except Exception as e:
        print(f"[!] Error binding to port {UDP_PORT}: {e}")
        print("[!] Ensure no other program is using port 5005.")
        sys.exit(1)

    count = 0
    while True:
        try:
            # 1. Receive data from ESP32
            data, addr = sock.recvfrom(1024)
            line = data.decode("utf-8", errors="replace").strip()
            count += 1
            print(f"[{count:04d}] From {addr[0]}: {line}")

            # 2. Forward to Web Dashboard
            req = urllib.request.Request(
                WEB_URL,
                data=line.encode("utf-8"),
                headers={"Content-Type": "text/plain"}
            )
            try:
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    pass
            except Exception as http_err:
                print(f"    -> Web App Forwarding Warning: {http_err}")

        except KeyboardInterrupt:
            print("\\n[!] Bridge stopped by user.")
            break
        except Exception as e:
            print(f"[!] Receive Error: {e}")
            time.sleep(0.05)

if __name__ == "__main__":
    main()
`;

  const esp32UdpSnippet = `# ESP32 webserver.py / spo2.py setup
# 1. Connect to WiFi hotspot
import network, socket, time

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("Ritesh's X7 Max", "hkrra2002")
while not wlan.isconnected():
    time.sleep_ms(200)
print("ESP32 IP:", wlan.ifconfig()[0])

# 2. Create UDP Socket pointing to your PC running bridge.py
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
DEST = ("172.26.135.152", 5005)    # Replace with your PC's IP if it changes

# 3. Inside main loop (in spo2.py):
# line = "BPM:%d SpO2:%s FILT:%.1f" % (bpm, spo2, ac_f)
# sock.sendto(line.encode(), DEST)
`;

  const mqttSnippet = `# ESP32 MicroPython Direct MQTT Publisher
import network, time, json
from umqtt.simple import MQTTClient

# 1. Connect WiFi
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("Ritesh's X7 Max", "hkrra2002")
while not wlan.isconnected():
    time.sleep_ms(200)
print("Connected:", wlan.ifconfig()[0])

# 2. Connect to Public HiveMQ / EMQX MQTT Broker (or private broker)
BROKER = "broker.hivemq.com"
TOPIC = b"esp32/vital-signs/data"

client = MQTTClient("esp32-vitals-client", BROKER, port=1883)
client.connect()
print("Connected to MQTT Broker!")

# 3. Inside your sensor loop:
# payload = json.dumps({"bpm": bpm, "spo2": spo2, "wave": ac_f})
# client.publish(TOPIC, payload)
`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/x-python;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-400 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-800" />
            <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-900">
              ESP32 & Python Setup Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 border border-transparent hover:border-slate-300 text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('bridge')}
            className={`px-3 py-1.5 font-mono text-xs uppercase font-bold border-t border-l border-r transition-colors ${
              activeTab === 'bridge'
                ? 'bg-white border-slate-300 text-slate-900 -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Python Bridge Script (Recommended)
          </button>

          <button
            onClick={() => setActiveTab('esp32_udp')}
            className={`px-3 py-1.5 font-mono text-xs uppercase font-bold border-t border-l border-r transition-colors ${
              activeTab === 'esp32_udp'
                ? 'bg-white border-slate-300 text-slate-900 -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2. ESP32 UDP Sender
          </button>

          <button
            onClick={() => setActiveTab('mqtt')}
            className={`px-3 py-1.5 font-mono text-xs uppercase font-bold border-t border-l border-r transition-colors ${
              activeTab === 'mqtt'
                ? 'bg-white border-slate-300 text-slate-900 -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Direct MQTT Setup
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-slate-800 space-y-4">
          {activeTab === 'bridge' && (
            <div>
              <div className="bg-slate-50 border border-slate-200 p-3 mb-3 text-slate-700 leading-relaxed">
                <p className="font-bold text-slate-900 mb-1">How it works:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Your ESP32 sends UDP packets to your PC at <code className="bg-white px-1 border border-slate-300">172.26.135.152:5005</code>.</li>
                  <li>Run this Python script on your PC: it receives those UDP packets and immediately relays them to this web dashboard via HTTP.</li>
                  <li>No modifications needed in your ESP32 code!</li>
                </ol>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="font-bold uppercase text-slate-700">bridge.py</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(bridgeScript)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'COPIED' : 'COPY CODE'}</span>
                  </button>
                  <button
                    onClick={() => handleDownload('bridge.py', bridgeScript)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>DOWNLOAD SCRIPT</span>
                  </button>
                </div>
              </div>

              <pre className="bg-slate-900 text-slate-100 p-3 overflow-x-auto text-[11px] leading-relaxed border border-slate-800 max-h-72">
                {bridgeScript}
              </pre>

              <div className="mt-3 bg-emerald-50 border border-emerald-300 p-2.5 text-emerald-900">
                <strong>Run Command:</strong>
                <code className="block bg-white p-1.5 mt-1 border border-emerald-200 font-bold">
                  python bridge.py
                </code>
              </div>
            </div>
          )}

          {activeTab === 'esp32_udp' && (
            <div>
              <p className="mb-2 text-slate-600 leading-relaxed">
                Your existing MicroPython code in <code className="bg-slate-100 px-1 border">webserver.py</code> and <code className="bg-slate-100 px-1 border">spo2.py</code> is already configured to transmit UDP packets:
              </p>

              <pre className="bg-slate-900 text-slate-100 p-3 overflow-x-auto text-[11px] leading-relaxed border border-slate-800 max-h-72">
                {esp32UdpSnippet}
              </pre>

              <div className="mt-3 bg-slate-50 border border-slate-200 p-3 text-slate-700">
                <strong>Note on IP address:</strong> If your PC's WiFi IP address changes from <code className="bg-white px-1">172.26.135.152</code>, check your PC IP using <code className="bg-white px-1">ipconfig</code> (Windows) or <code className="bg-white px-1">ifconfig</code> / <code className="bg-white px-1">ip a</code> (Mac/Linux) and update the <code className="bg-white px-1">DEST</code> tuple in your ESP32 code.
              </div>
            </div>
          )}

          {activeTab === 'mqtt' && (
            <div>
              <p className="mb-2 text-slate-600 leading-relaxed">
                If you prefer your ESP32 to publish directly to MQTT, you can use the script below with HiveMQ or EMQX public brokers, or your own local MQTT broker:
              </p>

              <div className="flex items-center justify-end mb-2">
                <button
                  onClick={() => handleCopy(mqttSnippet)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY CODE</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-slate-100 p-3 overflow-x-auto text-[11px] leading-relaxed border border-slate-800 max-h-72">
                {mqttSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Ingest API: <code className="text-slate-800 font-bold">{ingestEndpoint}</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs uppercase font-bold tracking-wider transition-colors"
          >
            CLOSE WINDOW
          </button>
        </div>
      </div>
    </div>
  );
};
