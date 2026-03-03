# Self-Hosted Thirdwatch

Run the full Thirdwatch cloud stack on your own infrastructure using Docker Compose.

## Prerequisites

- Docker 24+ and Docker Compose v2
- A GitHub OAuth App (for user login)
- Optional: Stripe account (for billing — not required for self-hosted)
- Optional: GitHub token (for enhanced release checking)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/poojitha-rachuri/thirdwatch.git
cd thirdwatch

# 2. Create secrets
mkdir -p docker/secrets
echo "your-db-password" > docker/secrets/db_password

# 3. Configure environment
cp docker/.env.example docker/.env
# Edit docker/.env with your GitHub OAuth credentials

# 4. Start the stack
cd docker
docker compose up -d

# 5. Run database migrations
docker compose exec -T postgres psql -U thirdwatch thirdwatch \
  < ../migrations/001_initial.sql \
  < ../migrations/003_impact_assessments.sql \
  < ../migrations/004_notification_log.sql \
  < ../migrations/005_cloud_platform.sql

# 6. Access the dashboard
open http://localhost:8080
```

## Configuration

### Environment Variables

Create a `docker/.env` file (see `docker/.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `APP_URL` | No | Public URL (default: `http://localhost:8080`) |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App secret |
| `GITHUB_TOKEN` | No | Token for enhanced release checking |
| `CHECK_INTERVAL_HOURS` | No | Polling interval (default: 6) |
| `STRIPE_SECRET_KEY` | No | Stripe key (billing) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook secret |
| `STRIPE_TEAM_PRICE_ID` | No | Stripe price ID for Team plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | No | Stripe price ID for Enterprise plan |

### Secrets

Sensitive values are stored as Docker secrets in `docker/secrets/`:

```
docker/secrets/
  db_password     # PostgreSQL password
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| web | 8080 | Dashboard (Next.js) |
| api | 3001 | REST API (Fastify) |
| worker | — | Background job processor |
| postgres | 5432 | Database |
| redis | 6379 | Job queue |

## Architecture

```
Browser → web:8080 → api:3001 → postgres:5432
                                → redis:6379
                    worker ──→ postgres:5432
                            → redis:6379
                            → npm/PyPI/GitHub (external)
```

## Data & Privacy

- **No source code** is transmitted or stored — only dependency metadata from the TDM
- All data stays within your infrastructure
- No phone-home or telemetry
- Licensed under BSL 1.1 (converts to Apache 2.0 after 3 years)

## Updating

```bash
cd docker
docker compose pull
docker compose up -d
```

## Backup

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U thirdwatch thirdwatch > backup.sql

# Restore
cat backup.sql | docker compose exec -T postgres psql -U thirdwatch thirdwatch
```

## Troubleshooting

### Database connection issues

```bash
docker compose logs postgres
docker compose exec postgres pg_isready -U thirdwatch
```

### Worker not processing jobs

```bash
docker compose logs worker
docker compose exec redis redis-cli ping
```

### API not responding

```bash
docker compose logs api
curl http://localhost:3001/healthz
```
