# ISDAKO

A phone app for fishers. Instead of writing down every delivery by hand, the fisher shows a QR code. Staff scan it, enter the catch, and the fisher sees their deliveries on their own phone straight away. If the fisher has a phone number on file, they also get an SMS each time a delivery is recorded.

ISDAKO has two parts:

| Folder | What it is |
| --- | --- |
| `server/` | The shared database and SMS sender (Node.js + TypeScript). It must be running so the fisher's phone and the staff phone see the same data. |
| `mobile/` | The app (Expo + React Native + TypeScript). Open it in **Expo Go**. |

## What each person sees

**Fishers**
- Scan their QR code once (or type the code). The app remembers it.
- **My catch**: today's catch on a yellow crate tag, totals for the last 7 days, this month and all time, and a list of every delivery.
- **My QR**: the QR code to show at delivery, and a switch for SMS alerts.

**Staff** (sign in with the staff PIN)
- **Scan**: point the camera at a fisher's QR, enter species, kilos or pieces and an optional price, then save.
- **Today**: everything delivered today, with day-by-day navigation.
- **Fishers**: search, open a fisher's record, add or change their phone number, show or replace their QR code.
- **New**: register a fisher. Their QR code is shown right away so they can scan it with their own phone.
- A wrong entry is never deleted. It is **voided** with a reason, it stops counting, and the fisher is told by SMS.

## 1. Start the server

You need Node.js 22.13 or newer.

```bash
cd server
npm install
npm run dev
```

The server prints the address your phone should use, for example `http://192.168.1.10:3000`.

Optional: add three sample fishers and print their codes.

```bash
npm run seed
```

The staff PIN is `1234` while you test. Before real use, set your own:

```bash
STAFF_PIN=your-secret-pin npm run dev
```

(On Windows PowerShell: `$env:STAFF_PIN="your-secret-pin"; npm run dev`.)

When `NODE_ENV=production`, the server refuses to start without `STAFF_PIN`.

## 2. Start the app in Expo Go

```bash
cd mobile
npm run setup
npx expo start
```

`npm run setup` installs the packages and then lets Expo pick the versions that match this project. Scan the QR code that appears in the terminal with Expo Go (Android) or the Camera app (iPhone).

Then in the app, tap **Server settings** on the first screen and enter the address the server printed. The app tests the connection before saving it.

Instead of typing it, you can copy `mobile/.env.example` to `mobile/.env` and put the address there.

**Same Wi-Fi.** Your phone and the computer running the server must be on the same Wi-Fi network. If the connection test fails, allow Node.js through the computer's firewall for private networks.

**Expo Go says the project is incompatible.** The project is built for Expo SDK 57. If your Expo Go is a different SDK, run this in `mobile/`:

```bash
npx expo install expo@^58.0.0 --fix
npx expo-doctor@latest
```

Change `58` to the SDK number shown by Expo Go.

**Using Expo's `--tunnel`.** This only tunnels the Expo bundler, not the ISDAKO server. The phone still needs to reach the server address.

**For real use**, put the server on a hosted machine with HTTPS and give the fishers and staff that address. A server on a laptop only works while the laptop is on and on the same Wi-Fi.

## 3. SMS alerts

I suggest SMS over Messenger. It works on any phone, including basic ones, and doesn't need the fisher to have data or an account. Messenger would require every fisher to have a Facebook account and to message your page first. Remote push notifications are also not available in Expo Go, so they wouldn't work in this setup.

The server decides when to send, so it works even if the fisher's app is closed.

Messages are short and plain (one SMS each):

```
ISDAKO: Hi Juan, we recorded 18.5 kg Tulingan (PHP 2,220.00). Today's total: 18.5 kg.
ISDAKO: Hi Juan, correction: your 18.5 kg Tulingan delivery on Oct 26 was cancelled.
```

**Test mode is the default.** With `SMS_PROVIDER=console` (the default), nothing is sent. The server prints `[SMS test mode] to …` and the app says nothing was actually sent. This lets you try everything without cost.

**Turning on real SMS**

Semaphore (Philippines, https://semaphore.co):

```bash
SMS_PROVIDER=semaphore SEMAPHORE_API_KEY=your-key npm run dev
# Optional: SEMAPHORE_SENDER=ISDAKO  (must be a Sender Name registered in your Semaphore account)
```

Twilio (https://www.twilio.com):

```bash
SMS_PROVIDER=twilio TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_FROM=+1... npm run dev
# or use TWILIO_MESSAGING_SERVICE_SID instead of TWILIO_FROM
```

Use `SMS_PROVIDER=off` to never send. See `server/.env.example` for every setting. The server refuses to start if the provider is set but its credentials are missing.

**Rules built in**
- Philippine mobile numbers only. `0917 123 4567`, `+63 917 123 4567` and `639171234567` are all accepted and stored as `+639171234567`.
- Each fisher can switch SMS on or off in their own app (on by default when a phone number is given).
- If the SMS gateway is down or slow (8 s limit), the delivery is **still saved**. The staff app shows "SMS failed" so they know to tell the fisher.
- The fisher's own app only ever shows a masked number like `0917 *** 4567`.

## Security notes

- Each QR holds a random 22-character code. Anyone who has the QR can see that fisher's deliveries (but cannot change anything). If a QR is lost or shared, staff can issue a new one and the old one stops working at once.
- Staff actions need the PIN. After signing in, the app holds a signed token that expires after 12 hours. Five wrong PINs from one address lock that address out for 10 minutes.
- Use HTTPS when the server is on the internet, and set `TRUST_PROXY=1` if it sits behind a proxy such as nginx or Cloudflare.
- The database is one file, `server/data/isdako.db`. Back it up.

## What was tested, and what was not

Tested (automatically, on the machine where this was built):
- **Server**: 80 checks pass. They cover PIN login and lockout, token tampering, phone number handling, SMS wording (plain ASCII, 160 characters or less), opt in and out, and the staff and fisher endpoints. The Semaphore and Twilio paths were tested against fake gateways that also simulated errors, hangs and an unreachable network, to confirm a delivery is never lost when SMS fails.
- **App logic**: 87 checks pass. They run the app's real `api`, `format`, `qr` and `storage` code against a live server: QR parsing, server address handling, money, weight and date formatting (Manila time), saving and clearing the session, and every request the app makes.
- **TypeScript**: the whole app type-checks.

**Not tested:**
- **The app screens have never been run on a phone or in Expo Go.** The environment this was built in cannot install Expo or open a device, so the screens were only type-checked against stand-ins for the React Native libraries. The camera scanner, QR drawing, layout, animations and the keyboard behavior on real devices are the most likely places for something to need a small fix. Please try it on a real phone and send me anything that looks wrong.
- **No real SMS was sent.** Semaphore and Twilio were only tested against fake servers, not the real services.

## Changes from the earlier web version

- The app is English and named ISDAKO.
- Fishers use the mobile app. There is no web page.
- The "print all QR cards" page is gone. Instead, staff show a fisher's QR on their phone and the fisher scans it with their own phone.
