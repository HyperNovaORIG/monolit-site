# MonoLit — Build Smarter

The marketing + auth + admin website for the **MonoLit** Minecraft Fabric client.
Pixel-art Minecraft aesthetic, FastAPI backend, vanilla-JS frontend, SQLite store.
Designed to be deployed in one process: FastAPI serves both the API and the
static frontend.

```
.
├── pyproject.toml
├── app/
│   ├── __init__.py
│   ├── main.py                  ← FastAPI app (entrypoint = `app.main:app`)
│   ├── db.py                    ← SQLAlchemy models + bootstrap
│   ├── schemas.py               ← Pydantic request/response models
│   ├── security.py              ← bcrypt + JWT session cookies
│   └── MonoLit-Lite-1.0.2A.jar  ← real download served at `/api/download/lite`
└── frontend/
    ├── index.html
    ├── css/style.css
    ├── js/app.js
    └── img/                     ← logo, favicon, vemix avatar
```

## What's in it

- **Public site** with: hero (animated Steve building a wheat farm), 8 features,
  schematic library preview, Lite vs Pro tier comparison, real downloads
  (Lite jar / Pro locked), 5-step install guide, Vemix creator section,
  public roadmap, DonutSMP 15M special offer, support form + 6-question FAQ.
- **Auth** — register / login with bcrypt-hashed passwords and JWT in a
  HttpOnly + SameSite=Lax cookie. Username is unique (case-insensitive,
  3-16 chars, `[A-Za-z0-9_]`). Rate limited.
- **Roles** — `User` / `Dev` / `Owner` shown on a colored badge in the header.
- **Admin Console** (Dev + Owner) — toggle launcher online/offline, toggle
  downloads on/off, set status message, broadcast announcements (shown to
  everyone in the marquee at the top), view/ban/unban users, change user
  role (Owner only), delete users (Owner only), create new accounts
  (Owner only), inbox of support tickets.
- **Account dropdown** — change password.
- **Animations** — boot loader, falling blueprint particles, animated farm
  grid, fake download progress, Steve swinging his pickaxe, scroll reveals.
- **Security** — bcrypt password hashing, JWT signed with a per-deploy
  random secret persisted to disk, HttpOnly cookies, CORS lock-down,
  rate limiting on register / login / support, security headers,
  password never returned over the wire.

## Owner credentials (change immediately)

- **username:** `pnexn`
- **password:** `MonoLitOwner!2025`

The Owner account is automatically seeded if it doesn't exist when the app
starts. After your first login, open the **Account** chip in the top-right
and change the password.

## Run locally

Requires Python 3.11+ and the [`uv`](https://docs.astral.sh/uv/) package
manager.

```bash
uv venv
uv sync
mkdir -p data
MONOLIT_DATA_DIR=$(pwd)/data uv run uvicorn app.main:app --host 0.0.0.0 --port 8765
```

Then open http://localhost:8765/.

The SQLite database lives at `$MONOLIT_DATA_DIR/monolit.db`. The JWT signing
secret is auto-generated on first run and stored in
`$MONOLIT_DATA_DIR/.monolit-secret` (mode `0600`).

## Deploy to a real host

The app is one process and listens on `$PORT`. It works on any platform that
runs a Python web service.

### Render / Railway / Fly.io / DigitalOcean App Platform

1. Push this repo to GitHub.
2. New web service from the repo. Use these settings:
   - **Build:** `pip install -e .` *(or `uv sync`)*
   - **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Persistent disk:** mount it at `/data` and set `MONOLIT_DATA_DIR=/data`
     so the SQLite DB survives redeploys.
3. Open the public URL — register/login and admin should just work.

### Bare-metal VPS (Ubuntu)

```bash
# 1. Install Python 3.11 and uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Pull the source, install deps
git clone <your-repo> monolit && cd monolit
uv sync

# 3. Run via systemd (create /etc/systemd/system/monolit.service)
[Unit]
Description=MonoLit website
After=network.target
[Service]
WorkingDirectory=/opt/monolit
Environment=MONOLIT_DATA_DIR=/var/lib/monolit
ExecStart=/opt/monolit/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
[Install]
WantedBy=multi-user.target
```

Put nginx / Caddy in front for TLS. Done.

## Replacing the Lite jar

The download endpoint serves whatever file is at
`app/MonoLit-Lite-1.0.2A.jar`. Replace the file on disk and the next click
of **Download Lite** ships the new build. If you change the version, also
update the `data-version` and `Files-Filename` text in
`frontend/index.html`.

## API surface

```
POST   /api/auth/register            { username, password }
POST   /api/auth/login               { username, password }
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/change-password     { current_password, new_password }

GET    /api/launcher/state
GET    /api/announcements
GET    /api/download/lite             → application/java-archive (real .jar)
GET    /api/download/pro              → 423 Locked

POST   /api/support                  { contact, subject, body }

# Dev + Owner
GET    /api/admin/users
POST   /api/admin/users/{id}/ban     { banned, reason }
POST   /api/admin/launcher           { online, downloads_enabled, status_message }
POST   /api/admin/announce           { body }
DELETE /api/admin/announce/{id}
GET    /api/admin/tickets

# Owner only
POST   /api/admin/users/{id}/role    { role }
DELETE /api/admin/users/{id}
POST   /api/admin/accounts           { username, password, role }
```

## License & credits

- Design / code: built for MonoLit by an AI engineer in one sitting.
- Vemix avatar (`frontend/img/vemix.jpg`) belongs to its creator.
- Press Start 2P + VT323 are loaded from Google Fonts.
- All Minecraft references are nominative; Minecraft is a Mojang trademark.
