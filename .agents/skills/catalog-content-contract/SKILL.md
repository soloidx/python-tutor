---
name: catalog-content-contract
description: Maintain the remote Python Tutor catalog contract, including resource SVG icons, validation, integrity, backup and coordinated changes in the content publisher.
---

Read `docs/catalog.md` before changing remote content consumption. The publisher lives in the sibling `../python-tutor-content` repository when available. Its `docs/contract.md`, `scripts/content-contract.mjs` and `scripts/svgIcon.js` are maintained copies of this consumer's contract and SVG validator. Update both projects together for contract changes; keep ordinary app presentation changes local.

Published `icon` is optional on a learning path, course or topic and is an object with relative `file` and exact-byte `sha256`. Source authoring in the content repository instead uses a string such as `icons/functions.svg`; its builder produces hashed references. Do not confuse the two representations or add course registry icons independently of course documents.

Validate every declared icon and hash before activating a complete publication; retain original SVG text in `iconFiles` so saved publications can reverify and display it without network. Preserve compatibility with icon-free catalogs and backups. Render verified icons via an image data URL, with local category icons as the default for omitted metadata. Never inject remote SVG markup into the DOM or weaken the static SVG allowlist to support arbitrary HTML, CSS, scripts, URL references or animation.

Verify contract changes through the actual app UI with controlled HTTP/storage, including invalid SVG, checksum mismatch, confined paths and cached rendering. In the content repository run `npm ci`, `npm run build` and `npm run check`; include editable sources and generated immutable files together. Keep old hashed files for clients finishing older downloads. Use the live canonical Pages URL documented by the publisher; redirects are rejected by the consumer.
