# Gabie World — handoff

Atualizado em 19/09/2026. Não há segredos neste arquivo.

## Estado atual

- Produção: https://www.gabie.space
- Repositório: https://github.com/ZXIIK-YO/gabie-world
- Next.js 16.3 (Turbopack), Supabase, Vercel e Cloudflare Workers AI.
- Supabase `fweudhjkwrcoqvjvhwes` em `sa-east-1`, migrations `0001_initial.sql` e `0002_secure_trigger.sql` aplicadas.
- Worker `gabie-world-classifier` publicado, com segredo Bearer na Vercel.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` **já estão** em Production (confirmado: o botão "Entrar com Google" aparece habilitado na produção).

## Credenciais: resolvidas

Nada aqui exige mais ação manual. Registro do que ficou configurado:

- `GEMINI_API_KEY` existe em Production na Vercel. **Pendência real:** a chave responde
  `429 quota exceeded` sem `quotaId`, mesmo com poucas chamadas — provável allowance zero
  para `gemini-3.5-flash-lite` **com grounding do Google Search** no tier gratuito.
  Investigar em https://ai.dev/rate-limit (projeto `781176747769`) ou testar sem grounding.
- Login Google: **funcionando em produção, verificado de ponta a ponta.**
  - Cliente OAuth "Gabie World" no projeto `gen-lang-client-0835684316` (Gemini API).
  - Redirect URI: `https://fweudhjkwrcoqvjvhwes.supabase.co/auth/v1/callback`
  - Tela de consentimento renomeada de "n8n-Synesis" para "Gabie World" (autorizado pelo dono;
    o n8n não é mais usado). Status **Em produção**, limite de 100 usuários por não ser verificado.
  - Supabase: provider Google habilitado, Site URL `https://www.gabie.space`, 4 redirect URLs
    (produção com e sem www, localhost 3000 e 3100, todas com `/**`).

Nunca cole chaves em commit, issue, chat público ou neste arquivo.

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

1. **Cota do Gemini.** A busca de preços não retorna ofertas: 429 em toda chamada.
   Sem isso, o botão "Usar" numa oferta (que registra a compra na peça) nunca foi exercitado.
2. **Compartilhamento e permissões de colaborador.** O schema tem `shared_builds` + view
   `public_shared_builds`, mas **não existe** tabela de colaborador nem policy para acesso
   compartilhado. Precisa de migration nova (ex.: `build_collaborators(build_id,user_id,role)`)
   e ajuste das policies de `builds`/`build_items`, que hoje só permitem o dono.
3. **Admin e promoção de `SUPER_ADMIN`.** O enum `app_role` existe, mas nenhuma policy usa.
   `profiles` hoje só deixa a pessoa ler a si mesma, então um admin não enxerga ninguém.
   **Atenção — furo conhecido:** a policy `profiles_update_self` permite `update` em qualquer
   coluna, inclusive `role`. Hoje qualquer usuário logado pode se promover a `SUPER_ADMIN`
   pelo cliente. Corrigir com `revoke update (role) on public.profiles from authenticated`
   antes de qualquer policy passar a confiar nesse campo.
4. **Rota `/api/prices` persistindo histórico** em `price_checks`/`price_results`
   (as tabelas existem e continuam vazias).
5. **Cache e rate limit compartilhados.** Os atuais são por instância serverless.
6. **Testes E2E** do resto das jornadas e responsividade.

## Verificações feitas

- `npm run lint`, `npm run typecheck`, `npm run build` — limpos a cada commit.
- Produção: `/api/prices` responde 200 com diagnóstico; `/auth/callback` redireciona; home e aba Perfil carregam sem erro de console.
- Local: empty state da busca renderizado e conferido no navegador.
- **Não verificado:** todo o caminho autenticado (bloqueio 2).

## Antes de continuar

`git status` tem alterações locais **não commitadas** em `design/` (`logo.svg`, `favicon.svg`, `preview.html`, `README.md` novo). São o design system da usuária — a logo do gatinho e os tokens exportados. Não descarte e não inclua em commits sem perguntar.
