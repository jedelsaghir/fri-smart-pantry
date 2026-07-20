# Platform adapters (architecture for D-1…D-4)

| Concern | Interface | Current adapter | Future |
|---------|-----------|-----------------|--------|
| Multi-device sync | `SyncProvider` | `local/sync-local` | Cloud API |
| Receipt OCR / camera | `OcrProvider` | `local/ocr-demo` | Vision model + MediaStream |
| Push notifications | `PushProvider` | `local/push-none` | Web Push + SW |
| Cross-device invites | `InviteProvider` | `local/invite-local` | Backend invite service |

```ts
import { getPlatform, createPlatform, setPlatform } from "@/platform";

// Default local stack
const platform = getPlatform();
await platform.ocr.detectFromImage(dataUrl);

// Later: inject cloud implementations without rewriting UI
setPlatform(createPlatform({
  sync: myCloudSync,
  ocr: myVisionOcr,
  push: myWebPush,
  invite: myRemoteInvites,
}));
```

UI should call `getPlatform()` instead of hardcoding demo behavior when migrating features (scan first).

## Current adoption

| Feature | Adapter used |
|---------|----------------|
| Receipt scan detection | `platform.ocr.detectFromImage` |
| Bell / enable alerts | `platform.push.requestPermission` + optional `notify` |
| Invite accept (local) | `platform.invite` available; Login still calls `lib/family` helpers that back the local adapter |

## Do we need more architecture?

| Layer | Status | Recommendation |
|-------|--------|----------------|
| **Platform adapters** (sync/ocr/push/invite) | Done | Enough for D-1…D-4 swaps |
| **Domain helpers** (`pantry-ops`, `catalog`, `shopping`, `backup`) | Done | Keep pure functions + tests |
| **Repositories** | Optional | Only if you add IndexedDB/SQLite or cloud APIs—then wrap `localStorage` behind `PantryRepository` |
| **Event bus / state store** | Optional | Only if multi-tab sync or complex cross-screen events hurt; React + hooks is fine for now |
| **Feature flags** | Optional | `createPlatform` overrides already act as a flag surface |
| **Further UI split** | Recommended | Extract Settings + Family drawers next (Alerts already extracted) when editing those areas |

**Bottom line:** No mandatory new architecture beyond finishing drawer extraction and gradually routing Login through `platform.invite`. Avoid Redux/etc. until multi-device sync ships.
