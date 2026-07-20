# Platform adapters

| Concern | Interface | Current adapter | Future |
|---------|-----------|-----------------|--------|
| Multi-device sync | `SyncProvider` | `local/sync-local` | Cloud API |
| Receipt OCR / camera | `OcrProvider` | **`local/ocr-xai`** (live vision) | Alternate models / on-device |
| Push notifications | `PushProvider` | `local/push-none` | Web Push + SW |
| Cross-device invites | `InviteProvider` | `local/invite-local` | Backend invite service |

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
  createServerFn ocrReceiptFromImage   ← XAI_API_KEY never leaves server
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
| `XAI_API_KEY` | Yes for live OCR | Server-only xAI key ([console.x.ai](https://console.x.ai)) |
| `XAI_OCR_MODEL` | No | Defaults to `grok-4.5` |

Without `XAI_API_KEY`, `detectFromImage` returns `ok: false` and **zero invented items**.

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
| Invites | `platform.invite` / `lib/family` |

## More architecture?

| Layer | Status |
|-------|--------|
| Platform adapters | Done for sync/ocr/push/invite |
| Domain helpers + OCR parse tests | Done |
| Repositories | Optional if leaving localStorage |
| Feature flags | `createPlatform` overrides |
