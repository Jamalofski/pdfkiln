# Changes

What each version changes, for those who use it. A version's release notes
open with its section here (scripts/release.ts), after the Chromium it
carries: no release without one. Up to 1.0.2, see each version's GitHub
release.

## 1.0.4

- `--no-custom-header-propagation` turns the propagation on, as in wkhtmltopdf 0.12.6, where it does what `--custom-header-propagation` does; up to 1.0.3, pdfkiln turned it off. Commands written for wkhtmltopdf that pass it send their `--custom-header` with every request again.
- On Windows Server Core, where Chromium cannot start, the conversion fails with a message that says so, instead of "Target closed". Windows Server with the Desktop Experience runs pdfkiln, IIS included: now tested as the application pool's identity.

## 1.0.3

- Security: the 52 fixes of Chrome 156.0.8078.73, 4 of them rated Critical by Google (Layout, Skia, FileSystem, FileAPI) and 46 High: [Google's announcement](https://chromereleases.googleblog.com/2026/10/stable-channel-update-for-desktop_0562499947.html). pdfkiln renders the pages it is given with this Chromium: update.
