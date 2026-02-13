.PHONY: help install build test lint clean docker-up docker-down helm-lint

SHELL := /bin/bash
.DEFAULT_GOAL := help

# ============================================================================
# AutoEcoOps Ecosystem v1.0 - Makefile
# ============================================================================

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	pnpm install --frozen-lockfile

build: ## Build all services
	pnpm run build

build-core: ## Build core services only
	pnpm run build:core

build-platforms: ## Build platform services only
	pnpm run build:platforms

test: ## Run all tests
	pnpm run test

test-core: ## Run core service tests
	pnpm run test:core

test-platforms: ## Run platform service tests
	pnpm run test:platforms

lint: ## Run linting
	pnpm run lint

type-check: ## Run TypeScript type checking
	pnpm run type-check

clean: ## Clean all build artifacts
	pnpm run clean

# ============================================================================
# Docker
# ============================================================================

docker-up: ## Start all services with Docker Compose
	cd docker && docker compose up -d

docker-down: ## Stop all Docker services
	cd docker && docker compose down

docker-build: ## Build all Docker images
	cd docker && docker compose build

docker-logs: ## View Docker logs
	cd docker && docker compose logs -f

# ============================================================================
# Helm
# ============================================================================

helm-lint: ## Lint Helm charts
	helm lint deploy/helm/ecosystem

helm-template: ## Template Helm charts (dry-run)
	helm template autoecops deploy/helm/ecosystem --namespace autoecops-core

helm-install: ## Install Helm chart to cluster
	helm upgrade --install autoecops deploy/helm/ecosystem \
		--namespace autoecops-core --create-namespace

helm-uninstall: ## Uninstall Helm chart
	helm uninstall autoecops --namespace autoecops-core

# ============================================================================
# Kubernetes
# ============================================================================

k8s-namespaces: ## Create Kubernetes namespaces
	kubectl apply -f deploy/k8s/base/namespaces.yaml

k8s-policies: ## Apply network policies
	kubectl apply -f deploy/k8s/base/network-policies.yaml

k8s-kyverno: ## Apply Kyverno policies
	kubectl apply -f deploy/policies/kyverno/cluster-policies.yaml

k8s-argocd: ## Apply ArgoCD applications
	kubectl apply -f deploy/argocd/applications.yaml

# ============================================================================
# Security
# ============================================================================

security-scan: ## Run Trivy security scan
	trivy fs --severity HIGH,CRITICAL .

sbom-generate: ## Generate SBOM for all services
	@for svc in auth-service memory-hub event-bus policy-audit infra-manager platform-01 platform-02 platform-03; do \
		echo "Generating SBOM for $$svc..."; \
		syft dir:core/$$svc -o cyclonedx-json > sbom-$$svc.json 2>/dev/null || \
		syft dir:platforms/$$svc -o cyclonedx-json > sbom-$$svc.json 2>/dev/null || true; \
	done

# ============================================================================
# Contracts
# ============================================================================

validate-openapi: ## Validate OpenAPI specification
	npx @redocly/cli lint interfaces/openapi/ecosystem-api.yaml

validate-asyncapi: ## Validate AsyncAPI specification
	npx @asyncapi/cli validate interfaces/asyncapi/ecosystem-events.yaml

validate-contracts: validate-openapi validate-asyncapi ## Validate all contracts
