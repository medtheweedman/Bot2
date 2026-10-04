---
name: Artifact Vite builds
description: Environment requirements for running production builds outside managed artifact workflows.
---

When building an artifact directly from the shell, supply the `PORT` and `BASE_PATH` values declared for that artifact. The managed workflow injects these values; a one-off `pnpm ... build` command does not.

**Why:** A missing variable can make a valid artifact appear broken during manual verification, while substituting the wrong base path can produce an incorrect build.

**How to apply:** Check the artifact's `[services.env]` in `.replit-artifact/artifact.toml` and use those exact values for standalone builds. Do not alter application configuration just to accommodate the manual command.