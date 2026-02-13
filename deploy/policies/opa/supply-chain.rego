package autoecops.supply_chain

import rego.v1

# ============================================================================
# Supply Chain Security Policy (SLSA Level 3)
# ============================================================================

default allow := false

# Allow if all supply chain checks pass
allow if {
    signature_valid
    sbom_present
    no_critical_vulnerabilities
    slsa_level_met
}

# ============================================================================
# Signature Verification
# ============================================================================

signature_valid if {
    input.image.signatureVerified == true
}

violations contains msg if {
    not signature_valid
    msg := sprintf("Image %s is not signed with cosign", [input.image.reference])
}

# ============================================================================
# SBOM Verification
# ============================================================================

sbom_present if {
    input.image.sbom.present == true
    input.image.sbom.format in {"CycloneDX", "SPDX"}
}

violations contains msg if {
    not sbom_present
    msg := sprintf("Image %s does not have a valid SBOM (CycloneDX or SPDX required)", [input.image.reference])
}

# ============================================================================
# Vulnerability Scanning
# ============================================================================

no_critical_vulnerabilities if {
    input.image.vulnerabilities.critical == 0
    input.image.vulnerabilities.high == 0
}

warnings contains msg if {
    input.image.vulnerabilities.critical == 0
    input.image.vulnerabilities.high > 0
    msg := sprintf("Image %s has %d high-severity vulnerabilities",
        [input.image.reference, input.image.vulnerabilities.high])
}

violations contains msg if {
    input.image.vulnerabilities.critical > 0
    msg := sprintf("Image %s has %d critical vulnerabilities - deployment blocked",
        [input.image.reference, input.image.vulnerabilities.critical])
}

# ============================================================================
# SLSA Level Verification
# ============================================================================

slsa_level_met if {
    input.image.slsaLevel >= 3
}

violations contains msg if {
    not slsa_level_met
    msg := sprintf("Image %s does not meet SLSA Level 3 (current: %d)",
        [input.image.reference, input.image.slsaLevel])
}

# ============================================================================
# Compliance Tags
# ============================================================================

compliance_tags contains "slsa-level-3" if { slsa_level_met }
compliance_tags contains "sbom-verified" if { sbom_present }
compliance_tags contains "signature-verified" if { signature_valid }
compliance_tags contains "vulnerability-scanned" if { true }
compliance_tags contains "supply-chain-secure" if { allow }
