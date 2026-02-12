# AutoEcoOps Ecosystem v1.0 - Architecture Document

## System Overview

The AutoEcoOps Ecosystem is an enterprise-grade Kubernetes-native platform composed of a **Shared Kernel** (control plane) and three **Platform** services (business domains), connected through versioned contracts and a unified SDK.

## Architecture Layers

### Shared Kernel (Control Plane)

The control plane provides five core services that all platforms depend on. These services run in the `autoecops-core` namespace and enforce enterprise-wide cross-cutting concerns.

| Service | Port | Responsibility |
|---------|------|---------------|
| auth-service | 4001 | OIDC federation, JWT verification, RBAC |
| memory-hub | 4002 | Document ingestion, vector embeddings, RAG search |
| event-bus | 4003 | Redis Streams event routing, replay, deduplication |
| policy-audit | 4004 | OPA policy evaluation, immutable audit trail, compliance reports |
| infra-manager | 4005 | ArgoCD reconciliation, drift detection, rollback hooks |

### Platform Services (Business Domains)

Each platform runs in its own namespace with independent scaling and lifecycle management.

| Platform | Port | Domain |
|----------|------|--------|
| Platform-01 (IndestructibleAutoOps) | 5001 | Observability, SLO monitoring, self-healing orchestration |
| Platform-02 (IAOps) | 5002 | IaC validation, GitOps deployment, supply chain compliance |
| Platform-03 (MachineNativeOps) | 5003 | Node baseline management, hardware inventory, edge agents |

### Contract Layer

All inter-service communication is governed by versioned contracts defined in the `interfaces/` directory. The OpenAPI specification covers synchronous REST APIs, while the AsyncAPI specification covers asynchronous event-driven communication via Redis Streams.

### SDK

The TypeScript SDK (`sdk/typescript/`) provides a unified client with built-in authentication, distributed tracing, retry logic with exponential backoff, and structured error handling.

## Request Flow

### Synchronous Request Flow

1. Client sends API request with JWT Bearer token
2. Platform service validates token via auth-service
3. Platform queries context from memory-hub (vector search)
4. Platform executes business logic
5. Platform writes audit entry to policy-audit (synchronous)
6. Platform returns API response

### Asynchronous Event Flow

1. Producer publishes event to Redis Streams via event-bus
2. Event includes traceId, actor, resource, policy decision, and idempotency key
3. Consumer groups process events with at-least-once delivery
4. Failed messages are retried with exponential backoff
5. After max retries, messages move to Dead Letter Queue (DLQ)
6. All event processing results are audited

## Security Model

The ecosystem implements defense-in-depth with multiple security layers. Network policies enforce namespace isolation with default-deny ingress and egress. Pod Security Standards are set to `restricted` mode. All containers run as non-root with read-only filesystems and dropped capabilities. Kyverno cluster policies enforce image signing, resource limits, and health probes at admission time.

## Deployment Model

The ecosystem uses GitOps with ArgoCD for declarative, version-controlled deployments. Helm charts define the desired state, and ArgoCD continuously reconciles the cluster to match. The infra-manager service provides an additional layer of drift detection with configurable auto-sync and rollback capabilities.
