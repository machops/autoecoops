# AutoEcoOps Ecosystem - Enterprise Evidence Chain

## 1. Supply Chain Security Evidence

### SLSA Build Level 3 Compliance

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Build Isolation | GitHub Actions hosted runners with ephemeral environments | `.github/workflows/ci.yaml` - each job runs in isolated container |
| Provenance Generation | Docker BuildKit SBOM + provenance attestation | `build-push-action` with `provenance: true, sbom: true` |
| Artifact Signing | Cosign keyless signing via Sigstore | `cosign sign --yes` in CI pipeline |
| SBOM Generation | Anchore SBOM action producing CycloneDX JSON | `sbom-action` attached to each image |
| Reproducible Build | Multi-stage Dockerfile with pinned base images | `Dockerfile` using `node:22-alpine` |

### Verification Commands

```bash
# Verify image signature
cosign verify ghcr.io/autoecops/auth-service:1.0.0

# Verify SBOM attachment
cosign verify-attestation --type cyclonedx ghcr.io/autoecops/auth-service:1.0.0

# Download and inspect SBOM
cosign download sbom ghcr.io/autoecops/auth-service:1.0.0 > sbom.json
```

## 2. Policy Enforcement Evidence

### Kyverno Cluster Policies

| Policy | Action | Scope | Evidence File |
|--------|--------|-------|---------------|
| `require-image-signature` | Enforce | All autoecops namespaces | `deploy/policies/kyverno/cluster-policies.yaml` |
| `disallow-privileged-containers` | Enforce | All pods | `deploy/policies/kyverno/cluster-policies.yaml` |
| `require-resource-limits` | Enforce | All autoecops namespaces | `deploy/policies/kyverno/cluster-policies.yaml` |
| `disallow-latest-tag` | Enforce | All autoecops namespaces | `deploy/policies/kyverno/cluster-policies.yaml` |
| `require-readonly-rootfs` | Audit | All autoecops namespaces | `deploy/policies/kyverno/cluster-policies.yaml` |
| `require-probes` | Audit | All autoecops namespaces | `deploy/policies/kyverno/cluster-policies.yaml` |
| `require-labels` | Audit | All autoecops namespaces | `deploy/policies/kyverno/cluster-policies.yaml` |

### OPA Policies

| Policy | Purpose | Evidence File |
|--------|---------|---------------|
| `autoecops.rbac` | Role-based access control | `deploy/policies/opa/rbac.rego` |
| `autoecops.supply_chain` | Supply chain verification | `deploy/policies/opa/supply-chain.rego` |

## 3. Audit Trail Evidence

### Immutable Audit Store

- **Storage**: PostgreSQL with append-only constraints
- **Immutability**: Database triggers prevent UPDATE and DELETE operations
- **Schema**: `core/policy-audit/src/services/audit.store.ts`
- **Retention**: 2555 days (~7 years) configurable

### Audit Entry Fields

| Field | Description | Compliance Mapping |
|-------|-------------|-------------------|
| `timestamp` | ISO 8601 event time | SOC2 CC7.2, ISO27001 A.12.4 |
| `traceId` | Distributed trace correlation | SOC2 CC7.2 |
| `actor` | Who performed the action | SOC2 CC6.1, ISO27001 A.9.2 |
| `resource` | What was affected | SOC2 CC6.1 |
| `action` | What was done | SOC2 CC7.2 |
| `result` | Outcome (success/failure/denied) | SOC2 CC7.2 |
| `policyDecision` | Policy evaluation result | SOC2 CC6.3 |
| `complianceTags` | Framework-specific tags | All frameworks |

## 4. Compliance Report Evidence

### Automated Report Generation

| Framework | Endpoint | Controls Covered |
|-----------|----------|-----------------|
| SOC2 | `POST /reports/compliance` | CC6.1, CC6.3, CC7.2, CC8.1 |
| ISO 27001 | `POST /reports/compliance` | A.9.2, A.12.4, A.14.2 |

### Implementation

- Report generator: `core/policy-audit/src/reports/compliance.report.ts`
- API route: `core/policy-audit/src/routes/policy.routes.ts`

## 5. Security Hardening Evidence

### Container Security

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Non-root execution | `USER appuser` (UID 1001) | All Dockerfiles |
| Read-only filesystem | `readOnlyRootFilesystem: true` | Helm deployment templates |
| Capability drop | `capabilities.drop: [ALL]` | Helm deployment templates |
| Seccomp profile | `RuntimeDefault` | Helm values.yaml |
| No privilege escalation | `allowPrivilegeEscalation: false` | Helm deployment templates |

### Network Security

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Default deny | NetworkPolicy per namespace | `deploy/k8s/base/network-policies.yaml` |
| Namespace isolation | Separate namespaces per platform | `deploy/k8s/base/namespaces.yaml` |
| Pod Security Standards | `restricted` enforcement | Namespace labels |
| mTLS | Service mesh ready (Istio) | Helm values `global.istio.enabled` |

### Authentication & Authorization

| Control | Implementation | Evidence |
|---------|---------------|----------|
| OIDC Federation | Keycloak/Supabase integration | `core/auth-service/src/services/oidc.service.ts` |
| JWT Verification | All API requests validated | `core/auth-service/src/middleware/auth.middleware.ts` |
| RBAC | Centralized policy engine | `core/auth-service/src/services/rbac.service.ts` |
| API Key Rotation | Rotation and CRL support | Auth service configuration |

## 6. Observability Evidence

### Structured Logging

All services emit structured JSON logs with mandatory fields:

```json
{
  "level": "info",
  "time": "2026-02-13T00:00:00.000Z",
  "service": "auth-service",
  "platformId": "core",
  "traceId": "uuid",
  "spanId": "uuid",
  "action": "verify",
  "decision": "allow",
  "msg": "Token verified"
}
```

### Metrics (OpenMetrics)

| SLO | Target | Metric |
|-----|--------|--------|
| Availability | ≥99.99% | `http_requests_total{status!~"5.."}` |
| P95 Latency | ≤200ms | `http_request_duration_seconds` |
| Error Rate | ≤0.1% | `http_requests_total{status=~"5.."}` |

### Health Probes

All services implement three-tier health checks:

| Probe | Path | Purpose |
|-------|------|---------|
| Liveness | `/live` | Process alive check |
| Readiness | `/ready` | Dependency health check |
| Startup | `/health` | Full health with dependency details |

## 7. Disaster Recovery Evidence

| Parameter | Target | Implementation |
|-----------|--------|---------------|
| RPO | ≤1 hour | Cross-region audit data replication |
| RTO | ≤15 minutes | ArgoCD auto-sync with self-heal |
| Multi-cluster | Active-Active ready | ArgoCD AppProject with multi-destination |
| Drift Detection | 60s interval | `core/infra-manager/src/reconcilers/argocd.reconciler.ts` |
| Auto-rollback | Configurable | Infra Manager rollback hooks |

## 8. GitOps Evidence

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Declarative config | Helm Charts + ArgoCD | `deploy/helm/`, `deploy/argocd/` |
| Version controlled | Git as single source of truth | GitHub repository |
| Automated sync | ArgoCD with self-heal | `deploy/argocd/applications.yaml` |
| Drift detection | Infra Manager + ArgoCD | `core/infra-manager/` |
| Rollback capability | ArgoCD revision history (10) | ArgoCD Application spec |
