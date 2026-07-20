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
