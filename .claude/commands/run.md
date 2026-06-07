# Run the Seating Planner

Start a local static server and open the app in the browser.

```bash
python3 -m http.server 8080 &
sleep 1
open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null || echo "Open http://localhost:8080 in your browser"
```

No build step required — the app is pure HTML/JS/CSS.
To stop the server: `kill %1` or find the PID with `lsof -i :8080`.
