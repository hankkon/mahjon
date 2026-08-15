#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────
# nginx entrypoint — bootstrap + substitute variables into nginx.conf.
#
# 1. If the real Let's Encrypt cert for $DOMAIN does not exist yet
#    (first boot / before running certbot), generate a self-signed cert
#    into /etc/nginx/certs so the stack can start immediately.
# 2. Substitute ${DOMAIN} and ${CERT_DIR} into the nginx.conf template
#    (mounted at /etc/nginx/templates/nginx.conf).
# 3. Run nginx in the foreground.
# ─────────────────────────────────────────────────────────────────────────
set -eu

: "${DOMAIN:?DOMAIN is required — set it in .env (see DEPLOYMENT.md)}"

# Default to the real Let's Encrypt certificate location.
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
    # No real cert yet → self-signed fallback so the container can boot.
    echo "[entrypoint] no Let's Encrypt cert for $DOMAIN yet — generating self-signed fallback…"
    CERT_DIR="/etc/nginx/certs"
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN" >/dev/null 2>&1
else
    echo "[entrypoint] using Let's Encrypt cert for $DOMAIN"
fi

export CERT_DIR
envsubst '${DOMAIN} ${CERT_DIR}' < /etc/nginx/templates/nginx.conf > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
