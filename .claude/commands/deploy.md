# Deploy to GitHub Pages

The app auto-deploys from the `main` branch root via GitHub Pages.

## Deploy
```bash
git push origin main
```
GitHub Pages picks up the new commit automatically. Changes are live at:
https://ohadsam.github.io/table_orginizer/

## Verify deployment
```bash
# Check that the page is up (should return HTTP 200)
curl -sI https://ohadsam.github.io/table_orginizer/ | head -1
```

## Requirements
- `.nojekyll` must exist at the repo root (it does — prevents Jekyll processing)
- GitHub Pages must be configured to deploy from `main` / root in repository Settings → Pages
- No build step — all files are served as-is

## Troubleshooting
- If pages show a 404, check that `.nojekyll` exists: `ls -la .nojekyll`
- If JS changes don't appear, try a hard-refresh (Ctrl+Shift+R) due to browser caching
- GitHub Pages can take 1–2 minutes to propagate after a push
