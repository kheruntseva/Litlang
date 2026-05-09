#!/bin/bash
# Generate a self-signed SSL certificate for local development

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SCRIPT_DIR/server.key" \
  -out "$SCRIPT_DIR/server.crt" \
  -subj "//C=US/ST=Dev/L=Dev/O=LitLang/OU=Dev/CN=localhost"

echo "Self-signed certificate generated:"
echo "  Key:  $SCRIPT_DIR/server.key"
echo "  Cert: $SCRIPT_DIR/server.crt"
