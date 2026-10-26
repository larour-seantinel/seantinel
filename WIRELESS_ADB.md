# Wireless ADB setup (one time)

Lets Claude install APKs without you touching the phone.

## Steps on the phone

1. Settings → **About phone** → tap **Build number** 7 times. (Skip if dev options already on.)
2. Settings → **System** → **Developer options** → scroll to **Wireless debugging** → turn ON.
3. Tap the **Wireless debugging** text (not the toggle) to open its detail page.
4. On that page, note the **IP address & Port** line, e.g. `192.168.0.17:43215`. That's the CONNECT port. Remember or screenshot it.
5. Tap **Pair device with pairing code**. New screen shows a DIFFERENT `IP:port` and a 6-digit code. Leave this screen open.

## Steps in Termux

6. `adb pair <PAIR_IP>:<PAIR_PORT>` — enter the 6-digit code when prompted.
7. Message Claude the CONNECT `IP:port` from step 4.

## Claude's side (automatic)

```
adb connect <CONNECT_IP:PORT>
adb install -r seantinel-spike.apk
adb shell am start -n com.seantinel.spike/.MainActivity
```

Pairing persists forever. CONNECT port can change per session but it's one command to redo.
