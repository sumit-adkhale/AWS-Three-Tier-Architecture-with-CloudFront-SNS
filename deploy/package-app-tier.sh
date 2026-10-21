#!/bin/bash
# Pack the app tier WITH node_modules and upload to S3 (app tier has no internet to run npm install).
# Usage: CODE_BUCKET=shop-code-yourname ./deploy/package-app-tier.sh   (Git Bash or WSL on Windows)
set -e
: "${CODE_BUCKET:?set CODE_BUCKET}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/app-tier"
npm install --omit=dev
tar -czf "$ROOT/app-tier.tar.gz" --exclude=.env .
aws s3 cp "$ROOT/app-tier.tar.gz" "s3://$CODE_BUCKET/app-tier.tar.gz"
rm "$ROOT/app-tier.tar.gz"
aws s3 cp "$ROOT/database/schema.sql" "s3://$CODE_BUCKET/schema.sql"
