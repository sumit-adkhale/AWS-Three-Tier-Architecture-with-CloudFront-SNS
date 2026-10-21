#!/bin/bash
# Build the React app, upload it to the private S3 site bucket, and refresh CloudFront.
# Usage: SITE_BUCKET=shop-site-yourname DISTRIBUTION_ID=E123ABC ./deploy/deploy-frontend.sh
set -e
: "${SITE_BUCKET:?set SITE_BUCKET}" "${DISTRIBUTION_ID:?set DISTRIBUTION_ID}"

cd "$(dirname "$0")/../frontend"
npm install
npm run build

# index.html must never be cached for long, so new deploys show up quickly
aws s3 sync dist "s3://$SITE_BUCKET" --delete --exclude "index.html" --cache-control "public,max-age=31536000"
aws s3 cp dist/index.html "s3://$SITE_BUCKET/index.html" --cache-control "no-cache"

aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/index.html"
echo "Deployed."
