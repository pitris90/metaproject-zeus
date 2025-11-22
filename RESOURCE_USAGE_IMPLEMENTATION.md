# Resource Usage Collection System - Implementation Summary

This document summarizes the implementation of the resource usage collection and integration system.

## Overview

The system collects resource usage data from PBS, accounting databases, and (future) OpenStack, transforms it into a unified format, and sends it to the ZEUS API for storage in a TimescaleDB hypertable.

## Architecture

```
Collector (Python)              ZEUS API (NestJS)
├── Models (Pydantic)           ├── DTOs (TypeScript)
├── Providers (PBS/DB)          ├── Controller (API endpoint)
├── Transform Layer         →   ├── Service (Business logic)
└── ZEUS Client (HTTP)          └── Database (TimescaleDB)
```

## Components Implemented

### 1. Collector (Python)

#### Data Models (`collector/src/models/`)
- **resource_usage.py**: Pydantic models
  - `ResourceUsageMetrics`: CPU/GPU time, RAM/storage allocation, vCPU counts, CPU percent, walltime allocated/used
  - `ResourceUsageEvent`: Complete event with metadata, metrics, identities, context

#### Transform Layer (`collector/src/transform/`)
- **resource_usage.py**: Base helpers
  - `build_resource_usage_event()`: Construct events from components
  - `aggregate_metrics()`: Build metrics objects
- **pbs.py**: PBS + accounting data transformation
  - `build_project_usage_from_pbs_and_accounting()`: Aggregates by project
- **openstack.py**: Future OpenStack transformation (placeholder)
  - `build_project_usage_from_openstack()`: Ready for implementation

#### ZEUS Client (`collector/src/zeus_client.py`)
- **ZeusClient**: HTTP client for API communication
  - Batching support (configurable via `COLLECTOR_BATCH_MAX`)
  - Retry logic and error handling
  - API key authentication via `X-Zeus-Collector-Key` header
  - Rich console logging for debugging

#### Configuration (`collector/.env.example`)
```env
ZEUS_ENDPOINT=http://localhost:3000
ZEUS_API_KEY=replace-me
COLLECTOR_BATCH_MAX=100
COLLECTOR_INTERVAL_SECONDS=86400
```

### 2. ZEUS API (NestJS)

#### DTOs (`api/src/resource-usage-module/dtos/`)
- **resource-usage-metrics.dto.ts**: Metrics validation
- **resource-usage-event.dto.ts**: Event validation with enums
- **resource-usage-events-payload.dto.ts**: Batch payload wrapper

#### API Endpoint (`api/src/resource-usage-module/`)
- **controllers/resource-usage.controller.ts**
  - `POST /collector/resource-usage`: Accept event batches
  - API key authentication via guard
  - Swagger documentation
- **services/resource-usage.service.ts**
  - Convert DTOs to entities
  - Batch insert into database
  - Logging and error handling
- **guards/collector-api-key.guard.ts**
  - Validates `X-Zeus-Collector-Key` header
  - Compares against `COLLECTOR_API_KEY` env var

#### Module Integration
- **resource-usage.module.ts**: Module definition
- **app.module.ts**: Integrated into main app
- **config/validationSchema.config.ts**: Added `COLLECTOR_API_KEY` validation

### 3. Database (TimescaleDB)

#### Entity (`shared/database/src/models/resource-usage/`)
- **resource-usage-event.ts**: TypeORM entity with TimescaleDB decorators
  - `@Hypertable` decorator for automatic hypertable creation
  - Time-series fields (time_window_start, time_window_end, collected_at)
  - Metadata fields (source, schema_version) with project/job identifiers stored inside `context`
  - JSONB fields (metrics, context, extra)
  - Composite indexes for efficient queries
  - Chunk interval: 30 days

#### Configuration
- Added to TypeORM config in `shared/database/src/config/typeorm.config.ts`
- Exported from `shared/database/src/index.ts`

#### Hypertable Setup
- **Automatic creation** via `@timescale/typeorm` decorators
- No manual SQL scripts required
- Optional compression and retention policies in `database/TIMESCALE_SETUP.md`

#### Link Table (`resource_usage_event_links`)

- Purpose: keep the original resource usage payload immutable while storing the resolved relationships (user ↔ identities, project ↔ context, allocation ↔ project) in a separate, query-friendly table.
- Workflow: after `ResourceUsageEvent` rows are persisted, the API runs `ResourceUsageMappingService` which:
  - resolves users directly from identities (`oidc_sub` → `externalId`, `user_email` → `email`, `perun_username` → `username`)
  - infers projects from the event context (plain PBS project names, `_pbs_project_default` → user default project, OpenStack prefixed names → reverse lookup using allocation payloads)
  - attaches the best-fit allocation (OpenStack GitOps record if present, otherwise latest allocation for that project)
- The resulting association triples are written to `resource_usage_event_links`, allowing manual corrections or re-runs without rewriting the Timescale hypertable rows.
- Benefits: keeps domain mapping logic auditable, enables joins from analytics/GUIs without touching raw JSON, and lets us re-run or override mappings independently from ingestion.

## Data Flow

1. **Collection** (Collector)
   - Fetch PBS jobs via OpenPBS API
   - Query accounting database for historical data
   - (Future) Collect OpenStack metrics

2. **Transformation** (Collector)
   - Aggregate data by project
   - Convert to `ResourceUsageEvent` objects
   - Validate with Pydantic models

3. **Transmission** (Collector → ZEUS)
   - Batch events (max 100 per request)
   - POST to `/collector/resource-usage`
   - Include API key in headers

4. **Storage** (ZEUS)
   - Validate DTOs
   - Convert to database entities
   - Insert into TimescaleDB hypertable

## Security

### API Key Authentication
1. **Generate API Key** (one-time):
   ```bash
   openssl rand -hex 32
   ```

2. **Configure ZEUS** (`api/.env`):
   ```env
   COLLECTOR_API_KEY=<generated-key>
   ```

3. **Configure Collector** (`collector/.env`):
   ```env
   ZEUS_API_KEY=<same-generated-key>
   ```

### Network Security
- Use HTTPS for production ZEUS endpoints
- Store API keys in secure secret management systems
- Rotate keys periodically

## Configuration Summary

### Collector Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `ZEUS_ENDPOINT` | ZEUS API base URL | `http://localhost:3000` |
| `ZEUS_API_KEY` | API key for authentication | `abc123...` |
| `COLLECTOR_BATCH_MAX` | Max events per request | `100` |
| `COLLECTOR_INTERVAL_SECONDS` | Collection frequency | `86400` (24h) |

### ZEUS Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `COLLECTOR_API_KEY` | Expected collector API key | `abc123...` |

## Usage

### Testing the API Endpoint

```bash
# Generate API key
API_KEY=$(openssl rand -hex 32)
echo "COLLECTOR_API_KEY=$API_KEY" >> api/.env
echo "ZEUS_API_KEY=$API_KEY" >> collector/.env

# After starting ZEUS API, test with curl:
curl -X POST http://localhost:3000/collector/resource-usage \
  -H "Content-Type: application/json" \
  -H "X-Zeus-Collector-Key: $API_KEY" \
  -d '{
    "events": [
      {
        "schema_version": "1.0",
        "source": "pbs",
        "time_window_start": "2025-11-19T00:00:00Z",
        "time_window_end": "2025-11-20T00:00:00Z",
        "collected_at": "2025-11-20T01:00:00Z",
        "metrics": {
          "cpu_time_seconds": 3600,
          "ram_bytes_allocated": 8589934592,
          "vcpus_allocated": 4,
          "used_cpu_percent": 72,
          "walltime_allocated": 7200,
          "walltime_used": 6800
        },
        "identities": [
          {
            "scheme": "perun_user",
            "value": "user123",
            "authority": "perun.cesnet.cz"
          }
        ],
        "context": {
          "cluster": "metacentrum",
          "project": "test-project-1",
          "jobname": "12345.meta",
          "job_count": 10
        }
      }
    ]
  }'
```

### Using the Collector Client

```python
from datetime import datetime, timedelta
from zeus_client import ZeusClient
from models.resource_usage import ResourceUsageEvent, ResourceUsageMetrics

# Initialize client
client = ZeusClient()

# Create sample event
event = ResourceUsageEvent(
  source="pbs",
  time_window_start=datetime.utcnow() - timedelta(days=1),
  time_window_end=datetime.utcnow(),
  collected_at=datetime.utcnow(),
  metrics=ResourceUsageMetrics(
    cpu_time_seconds=7200,
    vcpus_allocated=8,
    used_cpu_percent=81,
    walltime_allocated=86400,
    walltime_used=82000,
  ),
  context={"cluster": "metacentrum", "project": "my-project", "jobname": "12345.meta"},
  identities=[
    {
      "scheme": "perun_user",
      "value": "user123",
      "authority": "perun.cesnet.cz",
    }
  ],
)

# Send to ZEUS
client.send_resource_usage_events([event])
```

## Next Steps

### For PBS Integration
1. Refactor `pbs_ifl-test.py` into reusable provider module
2. Implement `src/providers/pbs/OpenPBS/pbs_jobs.py`
3. Create `src/providers/pbs/accountingDb/client.py`
4. Define SQL queries for accounting database
5. Implement aggregation logic in `transform/pbs.py`

### For OpenStack Integration
1. Set up Prometheus/Thanos metric collection
2. Create provider module for OpenStack API/metrics
3. Implement aggregation in `transform/openstack.py`
4. Define project UUID mapping

### For Orchestration
1. Evolve `main.py` into daily scheduler
2. Implement 24-hour collection loop
3. Add error handling per source
4. Add monitoring and alerting

## Files Modified/Created

### Collector
- ✅ `collector/src/models/__init__.py`
- ✅ `collector/src/models/resource_usage.py`
- ✅ `collector/src/transform/__init__.py`
- ✅ `collector/src/transform/resource_usage.py`
- ✅ `collector/src/transform/pbs.py`
- ✅ `collector/src/transform/openstack.py`
- ✅ `collector/src/zeus_client.py`
- ✅ `collector/.env.example`

### ZEUS API
- ✅ `api/src/resource-usage-module/dtos/resource-usage-metrics.dto.ts`
- ✅ `api/src/resource-usage-module/dtos/resource-usage-event.dto.ts`
- ✅ `api/src/resource-usage-module/dtos/resource-usage-events-payload.dto.ts`
- ✅ `api/src/resource-usage-module/guards/collector-api-key.guard.ts`
- ✅ `api/src/resource-usage-module/services/resource-usage.service.ts`
- ✅ `api/src/resource-usage-module/controllers/resource-usage.controller.ts`
- ✅ `api/src/resource-usage-module/resource-usage.module.ts`
- ✅ `api/src/app.module.ts`
- ✅ `api/config/validationSchema.config.ts`
- ✅ `.env.example`

### Database
- ✅ `shared/database/src/models/resource-usage/resource-usage-event.ts`
- ✅ `shared/database/src/config/typeorm.config.ts`
- ✅ `shared/database/src/index.ts`
- ✅ `database/TIMESCALE_SETUP.md`

## Build and Run

### Rebuild NPM Packages
```bash
# In api directory
cd api
npm install

# In shared/database directory
cd ../shared/database
npm install
```

### Setup Python Environment (Collector)
```bash
cd collector
poetry install
```

### Generate API Key
```bash
openssl rand -hex 32
```

### Apply Configuration
1. Copy generated key to both `.env` files
2. Update `ZEUS_ENDPOINT` in collector `.env`
3. Configure other required variables

### Start Services
```bash
# Start ZEUS API (from root)
docker-compose up -d

# After database is ready, run hypertable setup
# (see database/TIMESCALE_SETUP.md)

# Test collector (will need PBS credentials)
cd collector
poetry run python src/main.py
```

## Troubleshooting

- **401 Unauthorized**: Check API key matches in both `.env` files
- **TypeORM errors**: Ensure shared/database is built and linked
- **Import errors**: Verify PYTHONPATH includes `/app/src`
- **Hypertable not found**: Run TimescaleDB setup SQL manually
