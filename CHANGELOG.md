# Changes

What each version changes, for those who use it. A version's release notes
open with its section here (scripts/release.ts), after the Chromium it
carries: no release without one. Up to 1.0.2, see each version's GitHub
release.

## 1.0.5

- The PDFs no longer say which versions made them: Creator is `pdfkiln` and Producer `pdfkiln.org`, in every mode (wkhtmltopdf, native, `pdfkiln serve`). Up to 1.0.4, they gave the versions of pdfkiln and Chromium, which tell anyone who receives a PDF whether the server that made it still runs a Chromium with known flaws.
- A page's CSP reports and beacons, and the responses Chromium keeps from it (HTML for an image, an API without CORS headers), no longer fail the conversion. On https://www.google.fr, whose CSP reports Chromium sends and wkhtmltopdf 0.12.6 did not, pdfkiln called as wkhtmltopdf exited 1 with "network status code 99", a failure for the libraries; called as pdfkiln, it printed an error. A response kept from the page with an HTTP error fails as with wkhtmltopdf: same message, same exit code.

## 1.0.4

- Security: Chromium 156.0.8078.80, with the 21 fixes of Chrome 156.0.8078.79, 1 of them rated Critical by Google (MediaStream) and 19 High: [Google's announcement](https://chromereleases.googleblog.com/2026/10/stable-channel-update-for-desktop_02107719452.html). pdfkiln renders the pages it is given with this Chromium: update.
- `--no-custom-header-propagation` turns the propagation on, as in wkhtmltopdf 0.12.6, where it does what `--custom-header-propagation` does; up to 1.0.3, pdfkiln turned it off. Commands written for wkhtmltopdf that pass it send their `--custom-header` with every request again.
- On Windows Server Core, where Chromium cannot start, the conversion fails with a message that says so, instead of "Target closed". Windows Server with the Desktop Experience runs pdfkiln, IIS included: now tested as the application pool's identity.
- On Linux, a Chromium that cannot load a system library (the archive and the Composer package do not carry them) is named with the missing libraries, instead of "Target closed"; the README lists the Debian and Ubuntu packages.
- `pdfkiln serve` no longer crashes when Chromium exits at start: it reports why, as a conversion does.
- The packages (npm, Debian, Docker image, Windows installer, Scoop, winget, Homebrew, Composer) give https://pdfkiln.org as the home page.

## 1.0.3

- Security: the 52 fixes of Chrome 156.0.8078.73, 4 of them rated Critical by Google (Layout, Skia, FileSystem, FileAPI) and 46 High: [Google's announcement](https://chromereleases.googleblog.com/2026/10/stable-channel-update-for-desktop_0562499947.html). pdfkiln renders the pages it is given with this Chromium: update.
