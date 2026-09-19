# Gabie World — handoff

Atualizado em 19/09/2026. Não há segredos neste arquivo.

## Estado atual

- Produção: https://www.gabie.space
- Repositório: https://github.com/ZXIIK-YO/gabie-world
- Next.js 16.3 (Turbopack), Supabase, Vercel e Cloudflare Workers AI.
- Supabase `fweudhjkwrcoqvjvhwes` em `sa-east-1`, migrations `0001_initial.sql` e `0002_secure_trigger.sql` aplicadas.
- Worker `gabie-world-classifier` publicado, com segredo Bearer na Vercel.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` **já estão** em Production (confirmado: o botão "Entrar com Google" aparece habilitado na produção).

## Busca de preços: por que não é Google

Os dois caminhos do Google estão fechados no plano gratuito, e isso foi provado, não suposto:

- **Grounding do Gemini é pago.** Os três modelos (`gemini-3.5-flash-lite`, `2.5-flash`, `2.0-flash`)
  respondem 429 numa chamada com `google_search`, enquanto o *mesmo* modelo sem a ferramenta
  responde 200. A rota faz essa sonda sozinha e reporta `probe: model-ok-grounding-capped`.
  A chave tinha ~10 chamadas na vida, então não é cota diária esgotada: é allowance zero.
- **Custom Search JSON API nega acesso.** `403 PERMISSION_DENIED — "This project does not have
  the access to Custom Search JSON API"` em **dois** projetos diferentes, um deles criado do zero
  (`gabie-world-search`), com a API mostrando "Ativado" e cota "Queries per day: 100" provisionada,
  e com a chave criada dentro do projeto e restrita à API certa. O mesmo mecanismo de busca
  (`cx=146605be22f804a39`) **funciona** pelo widget em `cse.google.com`. Ou seja: o acesso à API
  JSON é que não está sendo concedido. Não adianta reconfigurar.

**Solução em produção: catálogo público do KaBuM.** Sem chave, sem cota. Traz o preço realmente
cobrado (o catálogo tem até três preços; vale o da oferta ativa), frete grátis, open box,
marketplace, estoque e link canônico do produto. É uma loja só — a UI mostra "KaBuM!" em cada
oferta, sem fingir que varreu o mercado.

Testado com UA de navegador: Terabyte, Pichau e Magalu respondem 403; Mercado Livre redireciona;
Amazon devolve só HTML. KaBuM foi a única com API aberta.

Gemini e Programmable Search seguem **antes** do KaBuM na cadeia e voltam a funcionar sozinhos se
as cotas aparecerem. Para cobertura multi-loja de verdade, a opção seria a Brave Search API
(~2.000 buscas/mês grátis) — não avaliada a fundo, e pode exigir cartão só para verificação.

### Números de modelo são obrigatórios

Buscar "RTX 4060 Ti" trazia 3060 Ti e 5060 Ti: o número era pontuado como palavra comum e um
fallback garantia que algo sempre aparecesse. Agora todo token de 3+ dígitos da busca precisa
existir no título; se nada sobra, a resposta é lista vazia. O KaBuM de fato não estoca 4060 Ti.

## O que foi feito nesta rodada

Commits `daad7fc`, `417c998`, `5fca992`, `7bf6ef9`, `f963a6b`.

### Busca de preços (verificado em produção)

O Mercado Livre **fechou a API pública**: todos os caminhos, inclusive `/sites/MLB`, respondem 403 para chamadas anônimas. O handoff anterior dizia que o fallback continuava funcionando — não estava. `searchMercadoLivre` lançava exceção e a rota virava 502, então **toda busca em produção falhava**, com ou sem Gemini.

Corrigido:

- Campo `sources` na resposta, com o resultado de cada fonte (a chave nunca é ecoada).
- 200 + `notice` quando nenhuma fonte tem ofertas — "sem resultado" não é erro de servidor.
- Mercado Livre continua no código e volta sozinho se o acesso voltar; a falha dele não derruba mais a rota.
- Gemini endurecido: timeout, extração de JSON entre cercas de código, ranking com fallback quando o modelo parafraseia títulos.
- Cache por instância (10 min) e rate limit por IP (30/5 min) para proteger a cota gratuita.
- A UI mostra o aviso com o gatinho triste em vez de lista vazia silenciosa.

### Autenticação (código pronto, fluxo não exercitado)

- `src/lib/supabase/{config,client,server}.ts` — clientes que retornam `null` sem env, mantendo o modo convidado vivo.
- `src/proxy.ts` — Next 16 renomeou `middleware` para `proxy`. Renova a sessão usando `getUser()`.
- `src/app/auth/callback/route.ts` — troca o code por sessão e rejeita `next` fora da origem.
- Aba Perfil roda o fluxo real do Google e mostra a conta conectada.

### Sincronização com Supabase (código pronto, não exercitado)

- `src/lib/remote-store.ts` — mapeia o `State` do guest para o schema relacional e reconcilia (upsert do que existe, delete do que saiu), com todo delete filtrado por `user_id`/`build_id` para a RLS continuar valendo.
- `src/lib/use-cloud-sync.ts` — puxa a conta uma vez por usuário e espelha edições com debounce de 900 ms.
- Migração guest → conta na primeira entrada com conta vazia, idempotente via `builds.guest_import_key`.
- `localStorage` só é escrito deslogado, para não vazar builds de uma pessoa para o próximo convidado no mesmo device.
- Indicador de sincronização no header.

### Correções de tema

- O tema salvo nunca era relido no load. Agora um script inline reaplica a escolha explícita antes do paint; `globals.css` já cobre `prefers-color-scheme` sozinho.

## Ainda falta

1. **Furo de privilégio.** `profiles_update_self` permite `update` em qualquer coluna, inclusive
   `role`: qualquer usuário logado se promove a `SUPER_ADMIN` pelo cliente. Corrigir com
   `revoke update (role) on public.profiles from authenticated;` antes de qualquer policy
   passar a confiar nesse campo. Não aplicado — é banco de produção e não foi pedido.
2. **Compartilhamento e colaboradores.** Existe `shared_builds` + view, mas nenhuma tabela de
   colaborador e nenhuma policy de acesso compartilhado. Precisa de migration
   (ex.: `build_collaborators(build_id,user_id,role)`) e reescrita das policies de
   `builds`/`build_items`, hoje só-dono.
3. **Painel admin.** O enum `app_role` existe e nenhuma policy usa. `profiles` só deixa a pessoa
   ler a si mesma, então um admin não enxerga ninguém. Promoção deve ser função `security definer`
   com allowlist, nunca update direto do cliente.
4. **Cache e rate limit compartilhados.** Hoje são memória por instância serverless: somem a cada
   deploy e não são compartilhados entre regiões.
5. **Testes E2E** das jornadas que sobraram e da responsividade em telas intermediárias.

## Verificações feitas

- `npm run lint`, `npm run typecheck`, `npm run build` — limpos a cada commit.
- Produção: `/api/prices` responde 200 com diagnóstico; `/auth/callback` redireciona; home e aba Perfil carregam sem erro de console.
- Local: empty state da busca renderizado e conferido no navegador.
- **Não verificado:** todo o caminho autenticado (bloqueio 2).

## Antes de continuar

`git status` tem alterações locais **não commitadas** em `design/` (`logo.svg`, `favicon.svg`, `preview.html`, `README.md` novo). São o design system da usuária — a logo do gatinho e os tokens exportados. Não descarte e não inclua em commits sem perguntar.
