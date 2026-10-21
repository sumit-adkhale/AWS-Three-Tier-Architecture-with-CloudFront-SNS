#!/bin/bash
# Upload the Nginx config for the web tier instances to download at boot.
# Usage: CODE_BUCKET=shop-code-yourname ./deploy/upload-web-tier.sh
set -e
: "${CODE_BUCKET:?set CODE_BUCKET}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
aws s3 cp "$ROOT/web-tier/nginx.conf" "s3://$CODE_BUCKET/web-tier/nginx.conf"
