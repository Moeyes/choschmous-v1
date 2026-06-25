# infra/mesh — mTLS & tier authorization (CHOS-505)

Service-mesh configuration that gives the MOEYS platform **mutual TLS between
tiers** and **deny-by-default authorization** for east-west traffic. Written for
[Istio]; the same intent maps to Linkerd (namespace annotation for mTLS +
`Server`/`AuthorizationPolicy` for the allow rules).

[Istio]: https://istio.io/

| File | Purpose |
| ---- | ------- |
| `peer-authentication.yaml` | `PeerAuthentication` STRICT — all pod-to-pod traffic is mTLS |
| `authorization-policy.yaml` | deny-all + explicit tier allow-rules (ingress→bff, ingress/bff→api) |

## What this protects

- **Confidentiality + integrity on the pod network.** With STRICT mTLS an
  attacker who lands on the cluster network still cannot sniff or spoof
  api↔bff↔workers calls — every hop is encrypted and mutually authenticated with
  SPIFFE identities Istio mints per ServiceAccount.
- **Least privilege between tiers.** The default-deny `AuthorizationPolicy` means
  a compromised tier can only reach the specific upstreams it legitimately needs
  (e.g. the BFF can call the API, but nothing can call the workers).

This is the network-layer expression of the deny-by-default ABAC engine
(CHOS-402) that already governs the application layer.

## What lives outside the mesh

PostgreSQL and Redis are managed services (RDS / ElastiCache, CHOS-205), not
mesh pods. Their connections are secured with **TLS enforced at the client /
terraform** (in-transit encryption required), not mesh mTLS. The threat model
(`docs/THREAT_MODEL.md`) covers both paths.

## Relationship to image signing

Mesh mTLS secures traffic *between* workloads; cosign
(`.github/workflows/docker.yml` + `infra/admission/cosign-verify-policy.yaml`)
ensures only *trusted* workloads are admitted in the first place. Together: only
signed images run, and everything they say to each other is mutually
authenticated.

> Not applied: no cluster/mesh was available. These manifests are unvalidated
> against a live Istio control plane. See the `TODO(infra)` notes in each file.
