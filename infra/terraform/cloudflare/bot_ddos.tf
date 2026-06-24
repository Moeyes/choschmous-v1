# CHOS-303: bot mitigation + L7 DDoS tuning.

# Zone hardening. Cloudflare's L3/4 + automatic L7 DDoS protection is always-on
# for proxied traffic; these settings raise the baseline.
resource "cloudflare_zone_settings_override" "hardening" {
  zone_id = var.zone_id
  settings {
    security_level           = "medium"
    challenge_ttl            = 1800
    browser_check            = "on"
    always_use_https         = "on"
    min_tls_version          = "1.2"
    opportunistic_encryption = "on"
    # Super Bot Fight Mode is configured via cloudflare_bot_management below on
    # plans that support it; browser_check covers the basic-bot case otherwise.
  }
}

# Bot management. Real ML-based bot scoring requires an Enterprise (or Pro+ Super
# Bot Fight Mode) plan. TODO(infra): confirm the zone's plan, then enable.
resource "cloudflare_bot_management" "this" {
  zone_id                  = var.zone_id
  enable_js                = true
  fight_mode               = true
  # TODO(infra): on Enterprise, switch to `sbfm_*` / `auto_update_model` controls
  # and add a firewall rule that challenges/blocks on `cf.bot_management.score`.
}

# L7 DDoS managed ruleset — keep on the Cloudflare-recommended defaults but make
# the override explicit so it is reviewable/tunable in code.
resource "cloudflare_ruleset" "ddos_l7" {
  zone_id     = var.zone_id
  name        = "moeys-ddos-l7"
  description = "HTTP DDoS managed ruleset override"
  kind        = "zone"
  phase       = "ddos_l7"

  rules {
    ref         = "ddos_l7_defaults"
    description = "Apply Cloudflare HTTP DDoS managed ruleset"
    expression  = "true"
    action      = "execute"
    action_parameters {
      id = "4d21379b4f9f4bb088e0729962c8b3cf" # Cloudflare HTTP DDoS managed ruleset
      # TODO(infra): per-rule `overrides` to raise sensitivity for known abuse
      # patterns once traffic is profiled.
    }
  }
}
