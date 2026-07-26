# Platform adapters

| Concern | Interface | Current adapter | Future |
|---------|-----------|-----------------|--------|
| Multi-device sync | `SyncProvider` | **`local/sync-cloud`** (server snapshot) | Upstash Redis for durable multi-instance |
| Receipt OCR / camera | `OcrProvider` | **`local/ocr-xai`** (live vision) | Alternate models / on-device |
| Push notifications | `PushProvider` | `local/push-none` | Web Push + SW |
| Cross-device invites | `InviteProvider` | **`local/invite-cloud`** (cloud registry + local fallback) | Production auth / magic links |

## OCR architecture (D-2 — wired)

```
Camera / library photo
        │
        ▼
  prepareImageForOcr (client resize)
        │
        ▼
  platform.ocr.detectFromImage(dataUrl)
        │
        ▼
  createServerFn ocrReceiptFromImage   ← thin wrapper (tss-serverfn-split safe)
        │
        ▼
  ocr-receipt.server.ts helpers        ← XAI_API_KEY never leaves server
        │
        ▼
  xAI Responses / Chat Completions (vision)
        │
        ▼
  parseReceiptOcrPayload → OcrDetectResult
        │
        ▼
  ReceiptScanFlow (auto-add high confidence, review low)
```

### Env

| Variable | Required | Purpose |
|----------|----------|---------|
| `XAI_API_KEY` | Yes for live OCR | Server-only xAI key ([console.x.ai](https://console.x.ai)) — **not** `VITE_*` |
| `XAI_OCR_MODEL` | No | Defaults to `grok-4.5` |

Without `XAI_API_KEY`, `detectFromImage` returns `ok: false` and **zero invented items**.

### OCR health / scan banner

`getOcrServerStatus` probes the server and returns a **safe** status (never the key value):

| `health` | Meaning | Banner |
|----------|---------|--------|
| `missing` | No server key | “OCR not configured” |
| `ok` | Key present + xAI models probe succeeded | No banner |
| `auth_failed` | Key present, xAI 401/403 | “OCR key rejected” |
| `network` | Key present, probe timed out / fetch failed | “OCR network issue” |
| `model` / `error` | Key present, other probe failure | Soft warning; scanning may still work |

`isConfigured()` is **true when a key is present**, even if the health probe failed — so a flaky network check no longer looks like a missing secret.

### Swap / test

```ts
import { getPlatform, createPlatform, setPlatform } from "@/platform";
import { demoOcrProvider } from "@/platform/local/ocr-demo";

// Default: live xAI adapter
await getPlatform().ocr.detectFromImage(dataUrl);

// Tests only — inject demo detections
setPlatform(createPlatform({ ocr: demoOcrProvider }));
```

### Key types

- `OcrLineItem` — name, qty, unit, confidence, price, storage  
- `OcrDetectResult` — `{ ok, mode, provider, items, store?, total?, reason? }`  
- `OcrProvider.supportsLiveCamera()` — `getUserMedia` availability  
- `OcrProvider.isConfigured()` — probes server for `XAI_API_KEY`

## Current adoption

| Feature | Adapter |
|---------|---------|
| Receipt scan | `platform.ocr` → server vision |
| Alerts enable | `platform.push` |
| Invites | `platform.invite` → cloud registry (`member-invite` + household-sync RPCs) |

## Cross-device family invites

```
Owner (signed in)
  Manage Family → Add member / Copy invite link
        │
        ▼
  publishMemberInvite → registerHouseholdInvite (server KV)
  + push household snapshot
        │
        ▼
  WhatsApp / link: /?invite=<unique-code>
        │
Joiner's phone
        ▼
  LoginScreen resolves invite (cloud first)
        │
        ▼
  acceptHouseholdInvite → pending→joined, fan-out snapshot
        │
        ▼
  Joiner lands in shared pantry; owner pulls on Manage Family open
```

**Env:** same as multi-device sync (`UPSTASH_REDIS_REST_*` recommended). Memory/fs backends only work if both devices hit the same server instance / filesystem.

## More architecture?

| Layer | Status |
|-------|--------|
| Platform adapters | Done for sync/ocr/push/invite |
| Domain helpers + OCR parse tests | Done |
| Repositories | Optional if leaving localStorage |
| Feature flags | `createPlatform` overrides |
