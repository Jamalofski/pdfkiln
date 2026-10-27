# Docker

`Dockerfile` installs the Debian package (`scripts/deb.ts`) on Debian 13 slim,
for an unprivileged user.

Docker's default seccomp profile stops Chromium's sandbox: it allows `clone`
and `unshare` only without namespace flags. `seccomp.json` is that default
profile plus `clone` and `unshare` for user, PID and network namespaces, the
ones the sandbox creates; mount, cgroup, UTS and IPC namespaces stay refused.

```sh
docker run --rm -i --security-opt seccomp=seccomp.json pdfkiln wkhtmltopdf - - < page.html > page.pdf
```

This is the recommended way (measured by CI, job `package`, step "Chromium's
sandbox in Docker"). `--security-opt seccomp=unconfined` and
`--cap-add SYS_ADMIN` also let the sandbox start, but the first drops the whole
filter and the second grants a capability that helps escape a container.
`--security-opt apparmor=unconfined` does not help: seccomp is what stops it.

`seccomp.json` is made by `node dist/scripts/seccomp.js <default.json>` from
`profiles/seccomp/default.json` of [moby/profiles](https://github.com/moby/profiles)
v0.2.4 (as vendored by moby at commit `b711d21792db`), Copyright Docker, Inc.,
Apache-2.0 (`../licenses/Apache-2.0.txt`).
