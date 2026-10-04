---
name: Private GitHub imports
description: Reliable approach for importing private repository source through Replit.
---

For private repositories, public GitHub URLs can return 404 until the account is authorized. After authorization, read repository contents through the authenticated GitHub connector. Large concurrent file requests may return 429, and archive downloads may be blocked; serialized content reads with brief pacing and retry are more reliable.

**Why:** The connector proxy can throttle bursts and restrict archive endpoints.

**How to apply:** For private repository imports, confirm access through the connector, read the tree, fetch file contents with low concurrency and backoff, then preserve project-level settings and artifact manifests while importing app-specific files.

When writing fetched files from an impure CodeExecution function, use validated workspace-relative paths; `process.cwd()` is unavailable in that runtime. Reject absolute paths and `..` segments before writing.

**Why:** The sandbox's Node process shim does not expose `process.cwd()`, so resolving an absolute workspace root fails even though relative filesystem writes work.

**How to apply:** Keep Git tree paths relative, validate every segment, create parent directories, write the files, and verify them against GitHub blob hashes.