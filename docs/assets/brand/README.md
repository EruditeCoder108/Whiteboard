# Floating Whiteboard logo

The master [transparent PNG](floating-whiteboard-logo.png) recreates the supplied blue-and-white
board logo. Its exterior has true alpha transparency; the white board tile and internal white
cards remain opaque. The master is raster artwork, not an editable vector.

Exports: [512 px](floating-whiteboard-logo-512.png), [256 px](floating-whiteboard-logo-256.png),
[64 px](floating-whiteboard-logo-64.png). The build icon is [build/icon.png](../../../build/icon.png).
Use the 512 px version in ordinary documentation; use the master when preparing larger artwork.

From the app directory, run `npm run icon` to regenerate those sizes. Run `npm run branding` to
also export the README cover and GitHub social cards. Both scripts use disposable profiles;
they do not open a user's board. Existing packaged EXEs are unchanged until rebuilt.

See [image generation prompts and provenance](../readme/GENERATION.md).
