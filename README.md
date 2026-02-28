# Unpackerr Custom Docker Platform

Browser-based control plane for Unpackerr that runs in Docker. It provides:

- Unpackerr install and upgrade actions from the UI
- Start/stop/restart runtime controls
- Live log/event monitoring
- Editable, validated TOML settings persisted to a Docker volume

## Quick start

1. Copy env template:

```bash
cp .env.example .env
```

2. Adjust host paths in `.env`:

- `HOST_DOWNLOADS_PATH` -> your actual downloads directory
- `HOST_MEDIA_PATH` -> your media/library root (optional)

3. Build and run:

```bash
docker compose up -d --build
```

4. Open:

- `http://localhost:8080`

## Portainer stack (test)

Use `portainer-stack.yml` if you want to deploy from Portainer.

- Stack file: `portainer-stack.yml`
- Host bind set for your downloads: `/Volume2/Media/downloads:/downloads`

Important: this stack uses `build:` so deploy it from **Git repository** mode in Portainer (repo URL + compose path), not the plain Web Editor with no source context.

## UI pages

- **Monitor**: live stream of Unpackerr output (SSE) and runtime status.
- **Lifecycle**: install, upgrade, start, stop, restart.
- **Settings**: edit and validate TOML config, then save.

## Runtime paths

Inside container:

- Config: `/data/config/unpackerr.conf`
- Binary: `/data/bin/unpackerr`
- Logs: `/data/logs/unpackerr.log`

All of these persist in Docker volume `unpackerr_data`.

## API endpoints

- `GET /api/health`
- `GET /api/unpackerr/status`
- `POST /api/unpackerr/install`
- `POST /api/unpackerr/upgrade`
- `POST /api/unpackerr/start`
- `POST /api/unpackerr/stop`
- `POST /api/unpackerr/restart`
- `GET /api/unpackerr/logs?limit=200`
- `GET /api/unpackerr/events` (SSE)
- `GET /api/unpackerr/config`
- `PUT /api/unpackerr/config`
- `POST /api/unpackerr/config/validate`

## Smoke test plan

1. Start stack: `docker compose up -d --build`
2. Confirm health: `curl http://localhost:8080/api/health`
3. In **Lifecycle**, click **Install** then **Start**
4. In **Monitor**, verify event stream updates
5. In **Settings**, edit config, validate, save
6. Restart stack and verify config persists

## Notes

- Unpackerr release is fetched from GitHub latest release API.
- Current installer expects a Linux amd64 release asset.
- If you want arm64 support, extend `pickAsset()` in `backend/src/services/unpackerrManager.ts`.
