---
name: Creator studio PIN policy
description: User-approved four-digit sign-in PIN and the security controls that must remain.
---

The user chose to use a four-digit numeric PIN for this app even though it is less secure than a long access code. Keep the session-signing secret requirement at 32 or more characters and retain failed-login throttling.

**Why:** The user said they only have a four-digit PIN and explicitly approved allowing it here.

**How to apply:** Accept exactly four digits for the workspace PIN. Do not store or log the PIN. Do not lower the signing-secret minimum or remove throttling without asking the user.