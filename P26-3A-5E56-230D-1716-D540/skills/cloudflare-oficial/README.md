# Skills oficiais da Cloudflare (terceiros)

Copiadas sem alteração de https://github.com/cloudflare/skills (commit `6eb6c781aa9b6438e0c7307bd102788a75fe1a6d`),
licença **Apache-2.0** (ver `LICENSE-APACHE-2.0`). O restante deste projeto é MIT.

| Skill | Usada por | Para quê |
|---|---|---|
| `wrangler/` | Agente Publicador Cloudflare | comandos Wrangler (D1, Pages, secrets) conferidos na documentação, sem chute |
| `workers-best-practices/` | Agente Auditor de Segurança e Agente Programador Back-end | anti-padrões de Workers: segredo no código, `Math.random()` para token, comparação de segredo sem tempo constante etc. |
