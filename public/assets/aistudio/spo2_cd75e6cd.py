# ESP32 + MAX30102 - MicroPython (serial output only)
# SDA = GPIO21, SCL = GPIO22

from machine import Pin, I2C
import time
from webserver import sock, DEST

I2C_SDA = 21
I2C_SCL = 22
MAX_ADDR = 0x57

FS = 100            # sensor sample rate (samples/second), set in SPO2_CONFIG
FINGER_IR = 50000   # IR level that means "finger present" (tune this)
BEAT_THRESH = 30    # pulse detection threshold (tune this)
DEBUG = False       # True = print filtered signal for tuning


# ---------------- MAX30102 driver ----------------
class MAX30102:
    def __init__(self, i2c, addr=MAX_ADDR):
        self.i2c = i2c
        self.addr = addr
        part = self._r(0xFF)
        if part != 0x15:
            raise OSError("MAX30102 not found (PART_ID=0x%02X)" % part)
        self._w(0x09, 0x40)             # reset
        time.sleep_ms(100)
        while self._r(0x09) & 0x40:     # wait for reset bit to clear
            time.sleep_ms(10)
        self._r(0x00)                   # clear interrupt status
        self._w(0x02, 0x00)             # interrupts off
        self._w(0x03, 0x00)
        self._w(0x04, 0x00)             # FIFO write pointer
        self._w(0x05, 0x00)             # overflow counter
        self._w(0x06, 0x00)             # FIFO read pointer
        self._w(0x08, 0x1F)             # no averaging, FIFO rollover on
        self._w(0x0A, 0x27)             # ADC 4096nA, 100 sps, 411us (18-bit)
        self._w(0x0C, 0x24)             # Red LED current (~7 mA)
        self._w(0x0D, 0x24)             # IR LED current (~7 mA)
        self._w(0x09, 0x03)             # SpO2 mode (Red + IR)

    def _w(self, reg, val):
        self.i2c.writeto_mem(self.addr, reg, bytes([val]))

    def _r(self, reg):
        return self.i2c.readfrom_mem(self.addr, reg, 1)[0]

    def read_fifo(self):
        wr = self._r(0x04)
        rd = self._r(0x06)
        n = (wr - rd) & 0x1F            # samples waiting (FIFO holds 32)
        samples = []
        if n:
            data = self.i2c.readfrom_mem(self.addr, 0x07, n * 6)
            for i in range(n):
                j = i * 6
                red = ((data[j] << 16) | (data[j+1] << 8) | data[j+2]) & 0x3FFFF
                ir = ((data[j+3] << 16) | (data[j+4] << 8) | data[j+5]) & 0x3FFFF
                samples.append((red, ir))
        return samples


# ---------------- Setup ----------------
i2c = I2C(0, scl=Pin(I2C_SCL), sda=Pin(I2C_SDA), freq=400000)
found = i2c.scan()
print("I2C devices:", [hex(a) for a in found])

if MAX_ADDR not in found:
    raise OSError("MAX30102 not found at 0x57 - check wiring")

sensor = MAX30102(i2c)


# ---------------- Processing state ----------------
def reset_window():
    return [0, 1 << 18, 0, 1 << 18, 0, 0, 0]   # count, rmin, rmax, imin, imax, rsum, isum

dc_ir = 0.0
ac_f = 0.0
ac_prev = 0.0
armed = False
since_beat = 0
intervals = []
bpm = 0
spo2 = None
finger = False
win = reset_window()
last_print = time.ticks_ms()


# ---------------- Main loop ----------------
while True:
    for red, ir in sensor.read_fifo():
        if ir < FINGER_IR:
            finger = False
            dc_ir = 0.0
            intervals = []
            bpm = 0
            spo2 = None
            win = reset_window()
            continue
        finger = True

        # Heart rate: remove slow DC level, smooth, detect each pulse
        if dc_ir == 0.0:
            dc_ir = ir
        dc_ir += (ir - dc_ir) * 0.02
        ac = dc_ir - ir                  # IR dips on each heartbeat; invert it
        ac_f += (ac - ac_f) * 0.3        # light smoothing
        since_beat += 1

        if ac_f < -BEAT_THRESH:
            armed = True
        if armed and ac_prev <= 0 < ac_f:
            ms = since_beat * 1000 // FS
            if 300 <= ms <= 2000:        # accept 30-200 BPM
                intervals.append(ms)
                if len(intervals) > 5:
                    intervals.pop(0)
                bpm = 60000 * len(intervals) // sum(intervals)
            since_beat = 0
            armed = False
        ac_prev = ac_f

        if DEBUG:
            print(ac_f)

        # SpO2 (rough): collect 2-second window of Red and IR
        win[0] += 1
        win[1] = min(win[1], red); win[2] = max(win[2], red)
        win[3] = min(win[3], ir);  win[4] = max(win[4], ir)
        win[5] += red; win[6] += ir
        if win[0] >= FS * 2:
            n = win[0]
            if win[2] > win[1] and win[4] > win[3]:
                r = ((win[2] - win[1]) / (win[5] / n)) / ((win[4] - win[3]) / (win[6] / n))
                spo2 = max(0, min(100, int(110 - 25 * r)))
            win = reset_window()

    # Print status 5 times a second
    if not DEBUG and time.ticks_diff(time.ticks_ms(), last_print) >= 200:
        last_print = time.ticks_ms()
        line = "BPM:%d SpO2:%s FILT:%.1f" % (bpm, spo2, ac_f)
        print(line)
        sock.sendto(line.encode(), DEST)
        

    time.sleep_ms(10)