# OpenClaw via Docker (separate repo)

This EV model repo stays independent. Run the **OpenClaw gateway** from an OpenClaw checkout using the official Docker flow.

## Prerequisites

- Docker Desktop or Docker Engine + Compose v2
- A clone of [openclaw/openclaw](https://github.com/openclaw/openclaw) (sibling folder is convenient)

## One-time gateway setup

From the **OpenClaw** repository root (not this repo):

```bash
cd /path/to/openclaw
export OPENCLAW_IMAGE="ghcr.io/openclaw/openclaw:latest"
./scripts/docker/setup.sh
```

The script builds or pulls the image, runs onboarding, and starts `docker compose` with the gateway on port **18789** by default.

## After setup

- Control UI: open `http://127.0.0.1:18789/` and use the gateway token from your OpenClaw config (see upstream docs).
- CLI via container:

```bash
docker compose run --rm openclaw-cli dashboard --no-open
```

## Full reference

- [Docker install](https://docs.openclaw.ai/install/docker)

## Wiring this model to an agent

Keep this package as a library or small CLI; configure your OpenClaw agent (in the OpenClaw workspace) to call your tooling or expose results through your preferred channel. No code in OpenClaw core is required for local experiments.
