package autoecops.rbac

import rego.v1

# ============================================================================
# AutoEcoOps RBAC Policy
# ============================================================================

default allow := false

# Platform Admin - full access
allow if {
    "platform-admin" in input.actor.roles
}

# Platform Operator - operational access (no delete, no policy write)
allow if {
    "platform-operator" in input.actor.roles
    not input.action in admin_only_actions
}

# Platform Viewer - read-only access
allow if {
    "platform-viewer" in input.actor.roles
    input.action == "read"
}

# Service accounts - inter-service communication
allow if {
    input.actor.type == "service"
    input.actor.id in trusted_services
    input.action in service_allowed_actions
}

# ============================================================================
# Action Definitions
# ============================================================================

admin_only_actions := {
    "delete",
    "rollback",
    "policy:write",
    "user:admin",
    "namespace:delete",
    "cluster:admin",
}

service_allowed_actions := {
    "read",
    "write",
    "execute",
    "sync",
    "publish",
    "subscribe",
    "audit:write",
}

trusted_services := {
    "auth-service",
    "memory-hub",
    "event-bus",
    "policy-audit",
    "infra-manager",
    "platform-01",
    "platform-02",
    "platform-03",
}

# ============================================================================
# Violations & Warnings
# ============================================================================

violations contains msg if {
    not allow
    msg := sprintf("Access denied: actor=%s action=%s resource=%s/%s",
        [input.actor.id, input.action, input.resource.kind, input.resource.id])
}

warnings contains msg if {
    "platform-operator" in input.actor.roles
    input.action in {"execute", "sync", "deploy"}
    msg := sprintf("Operator performing sensitive action: %s on %s/%s",
        [input.action, input.resource.kind, input.resource.id])
}

# ============================================================================
# Compliance Tags
# ============================================================================

compliance_tags contains "rbac" if { true }
compliance_tags contains "access-control" if { true }
compliance_tags contains "soc2-cc6.1" if { true }
compliance_tags contains "iso27001-a9.2" if { true }
