# Harvest Time Tracker — Trello Power-Up

Custom Trello Power-Up that displays Harvest time entries directly on Trello cards.

## Features
- **Card front badge**: Total tracked hours (configurable: full/minimal/hidden)
- **Card detail badges**: Total, billable, non-billable hours summary
- **Card back section**: Full list of time entries with date, task, notes, hours, billable status
- **Settings**: Harvest API credentials + badge visibility per board

## Local Development

1. Start local HTTPS server:
   ```bash
   npx local-ssl-proxy --source 5555 --target 5556 &
   npx http-server -p 5556 --cors
   ```

   Or simpler with a single command:
   ```bash
   npx @anthropic-ai/claude-code # not needed, just use:
   npx http-server -p 5556 --cors -S -C cert.pem -K key.pem
   ```

2. Register Power-Up at https://trello.com/power-ups/admin
   - Connector URL: `https://localhost:5555/index.html`
   - Capabilities: card-badges, card-detail-badges, card-back-section, board-buttons

3. Add Power-Up to your board

4. Click "Harvest Settings" board button → enter credentials

## Deployment

Host files on any static host (Vercel, Netlify, GitHub Pages).
Update connector URL in Trello Power-Up admin.
