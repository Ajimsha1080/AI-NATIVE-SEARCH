# Security Policy & Incident Postmortem

## Incident Postmortem: Exposure of Sarvam AI API Key

**Date:** 2026-09-28  
**Severity:** HIGH  
**Status:** MITIGATED & ROTATED  

---

### 1. Incident Summary
An API key for Sarvam AI (`REDACTED_SECRET`) was committed to the repository in the `.env` file and referenced as a hardcoded fallback in `src/lib/agent-runtime/index.ts`.

### 2. Root Cause Analysis
1. **Missing `.gitignore` Rule**: `.gitignore` contained only `.env*.local`, omitting the bare `.env` file.
2. **Insecure Code Fallback**: Legacy code previously contained hardcoded key fallbacks, which bypassed environment variable isolation.

### 3. Immediate Remediation Actions Taken
- **Revocation & Invalidation**: The exposed API key has been revoked and marked as compromised. All developers/deployments must generate a new API key from the [Sarvam AI Console](https://dashboard.sarvam.ai).
- **Code Remediation**: Removed all hardcoded string fallbacks in `src/lib/agent-runtime/index.ts`. Keys are now read strictly from `process.env` with no fallback literals.
- **Git Untracking**: Ran `git rm --cached .env` to purge the tracked environment file from version control.
- **Gitignore Hardening**: Added bare `.env`, `.env.production`, `.env.development`, `.env.test` to `.gitignore` with an explicit whitelist for `.env.example`.
- **Sanitized Templates**: Replaced exposed keys in `.env.example` with `sk_YOUR_KEY_HERE`.
- **Automated CI Secret Scanner**: Added `scripts/security-audit.js` and a GitHub Actions workflow (`.github/workflows/security-scan.yml`) to block any PR/push containing API key patterns (`sk_`, `rzp_`, `shpat_`, `whsec_`) or mock indicators.

---

### 4. Git History Cleanup Guide for Collaborators
To purge the exposed key from historical commits using `git-filter-repo` or `BFG Repo-Cleaner`:

```bash
# Using git-filter-repo (Recommended)
pip install git-filter-repo
git filter-repo --invert-paths --path .env
git filter-repo --replace-text expressions.txt
git push origin --force --all
```

All team members should re-clone the repository fresh after history rewriting.

---

### 5. Reporting a Security Vulnerability
If you discover a security vulnerability within this repository, please report it immediately to the security team rather than opening a public issue.
