# pdfkiln on Debian 13 slim, installed from the Debian package of
# scripts/deb.ts, run by an unprivileged user, with Chromium's sandbox on.
#
#   node dist/scripts/package.js && node dist/scripts/deb.js
#   docker build -t pdfkiln -f docker/Dockerfile dist/package
#   docker run --rm -i pdfkiln wkhtmltopdf - - < page.html > page.pdf
#
# The context may hold the packages of both architectures: each platform's
# build takes its own (TARGETARCH, set by BuildKit), so that docker.yml
# builds the amd64 and arm64 images from one context.
#
# The entry point is pdfkiln: "wkhtmltopdf" or "wkhtmltoimage" as first
# argument switches to the compatible mode. Chromium's sandbox needs README.md's seccomp profile.
FROM debian:13-slim
ARG TARGETARCH

COPY pdfkiln_*_${TARGETARCH}.deb /tmp/
RUN apt-get update \
 && apt-get install -y --no-install-recommends /tmp/pdfkiln_*.deb fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* /tmp/pdfkiln_*.deb \
 && useradd --create-home --uid 10001 pdfkiln

USER pdfkiln
WORKDIR /home/pdfkiln
ENTRYPOINT ["pdfkiln"]
CMD ["--help"]
