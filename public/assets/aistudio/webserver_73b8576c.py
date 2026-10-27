import network, socket
from umqtt.simple import MQTTClient
import json


wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("Ritesh's X7 Max", "hkrra2002")
while not wlan.isconnected():
    time.sleep_ms(200)
print("ESP32 IP:", wlan.ifconfig()[0])


client = MQTTClient("esp32-max30102", "YOUR_BROKER_HOST",
                    port=8883, user="USER", password="PASS", ssl=True)
client.connect()
last_pub = time.ticks_ms()

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
DEST = ("172.26.135.152", 5005)    # IP of the receiving device, and a port
