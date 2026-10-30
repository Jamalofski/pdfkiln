# Changes

What each version changes, for those who use it. A version's release notes
open with its section here (scripts/release.ts), after the Chromium it
carries: no release without one. Up to 1.0.2, see each version's GitHub
release.

## 1.1.0

Called as `pdfkiln`, four changes break commands that worked with 1.0.4; called as `wkhtmltopdf`, nothing changes. What to do for each:

- Private addresses are refused by default: give `--allow-private-network` to a page that loads from localhost or a private network.
- An input that does not load fails, exit 1 and no PDF, where 1.0.4 wrote a blank page and exited 0: test the exit code.
- The messages on stderr are new: a program that reads them reads `could not load <input>: <why>`.
- An input is a URL only with its scheme: write `https://www.example.com`, not `www.example.com`.

All the changes:

- The PDFs no longer say which versions made them: Creator is `pdfkiln` and Producer `pdfkiln.org`, in every mode (wkhtmltopdf, native, `pdfkiln serve`). Up to 1.0.4, they gave the versions of pdfkiln and Chromium, which tell anyone who receives a PDF whether the server that made it still runs a Chromium with known flaws.
- A page's CSP reports and beacons, and the responses Chromium keeps from it (HTML for an image, an API without CORS headers), no longer fail the conversion. On https://www.google.fr, whose CSP reports Chromium sends and wkhtmltopdf 0.12.6 did not, pdfkiln called as wkhtmltopdf exited 1 with "network status code 99", a failure for the libraries; called as pdfkiln, it printed an error. A response kept from the page with an HTTP error fails as with wkhtmltopdf: same message, same exit code.
- Called as `pdfkiln`, private addresses are refused by default: pages reach no loopback, private or link-local address (cloud metadata `169.254.169.254` included) unless `--allow-private-network` is given, a local development server included. `--block-private-network`, now the default, is deprecated: it still works, out of the help, and will be removed in a future version. And an input that does not load, refused or in HTTP error, fails: exit 1 and no PDF, where 1.0.4 wrote a blank page and exited 0. Called as `wkhtmltopdf`, nothing changes.
- Called as `pdfkiln`, the messages are its own. An input that does not load gives one error, `could not load <input>: <why>`; a resource that does not load (an image, a font, a style sheet, a frame, a script's request) gives a warning, `could not load <url>: <why>`, which `-q` hides. The why: `HTTP 404`, `10.0.0.1 is a private address (--allow-private-network to reach it)` or, for a name, `intranet.example.com resolves to a private address (…)`, `host not found`, `connection refused`, `timed out`, `connection closed`, `invalid certificate (net::ERR_CERT_…)`, `no such file`, `not an allowed file (…)`, or, for the rarer ones, Chromium's name for the error. Up to 1.0.4, they were wkhtmltopdf's: a resource it did not count as a media file gave an error though the conversion succeeded, a page that did not load advised `--load-error-handling`, which `pdfkiln` does not have, and with `--block-private-network` a host that does not exist was an HTTP 502. Programs that read these lines have new ones to read.
- Called as `pdfkiln`, an input is a URL when it starts with `http:`, `https:`, `file:` or `data:`, and a file otherwise. `pdfkiln www.example.com out.pdf`, which 1.0.4 took for http://www.example.com/, now fails with `no such file (a URL starts with https://)`: write `https://www.example.com`. And a missing `report.html` fails with `no such file`, where 1.0.4 looked for http://report.html/.

## 1.0.4

- Security: Chromium 156.0.8078.80, with the 21 fixes of Chrome 156.0.8078.79, 1 of them rated Critical by Google (MediaStream) and 19 High: [Google's announcement](https://chromereleases.googleblog.com/2026/10/stable-channel-update-for-desktop_02107719452.html). pdfkiln renders the pages it is given with this Chromium: update.
- `--no-custom-header-propagation` turns the propagation on, as in wkhtmltopdf 0.12.6, where it does what `--custom-header-propagation` does; up to 1.0.3, pdfkiln turned it off. Commands written for wkhtmltopdf that pass it send their `--custom-header` with every request again.
- On Windows Server Core, where Chromium cannot start, the conversion fails with a message that says so, instead of "Target closed". Windows Server with the Desktop Experience runs pdfkiln, IIS included: now tested as the application pool's identity.
- On Linux, a Chromium that cannot load a system library (the archive and the Composer package do not carry them) is named with the missing libraries, instead of "Target closed"; the README lists the Debian and Ubuntu packages.
- `pdfkiln serve` no longer crashes when Chromium exits at start: it reports why, as a conversion does.
- The packages (npm, Debian, Docker image, Windows installer, Scoop, winget, Homebrew, Composer) give https://pdfkiln.org as the home page.

## 1.0.3

- Security: the 52 fixes of Chrome 156.0.8078.73, 4 of them rated Critical by Google (Layout, Skia, FileSystem, FileAPI) and 46 High: [Google's announcement](https://chromereleases.googleblog.com/2026/10/stable-channel-update-for-desktop_0562499947.html). pdfkiln renders the pages it is given with this Chromium: update.
