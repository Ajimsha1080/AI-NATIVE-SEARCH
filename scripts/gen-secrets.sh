#!/usr/bin/env bash
# ==============================================================================
# Script: gen-secrets.sh
# Purpose: Generate high-entropy, cryptographically strong secrets for production
# ==============================================================================
set -euo pipefail

echo "================================================================="
echo "  GENERATING PRODUCTION SECRETS FOR AAAS PLATFORM"
echo "================================================================="

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  fi
}

POSTGRES_PW=$(gen_secret)
SESSION_SECRET=$(gen_secret)
SERVICE_SECRET=$(gen_secret)
ENCRYPTION_SECRET=$(gen_secret)

echo ""
echo "# Generated on $(date -u)"
echo "POSTGRES_PASSWORD=\"${POSTGRES_PW}\""
echo "SESSION_JWT_SECRET=\"${SESSION_SECRET}\""
echo "SERVICE_JWT_SECRET=\"${SERVICE_SECRET}\""
echo "INTERNAL_SERVICE_SECRET=\"${SERVICE_SECRET}\""
echo "ENCRYPTION_KEY=\"${ENCRYPTION_SECRET}\""
echo ""
echo "================================================================="
echo "Copy these values into your .env or CI deployment secrets."
echo "================================================================="
