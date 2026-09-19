# Gabie World — handoff

Atualizado em 19/09/2026. Não há segredos neste arquivo.

## Estado atual

- Produção: https://www.gabie.space
- Repositório: https://github.com/ZXIIK-YO/gabie-world
- Next.js 16.3 (Turbopack), Supabase, Vercel e Cloudflare Workers AI.
- Supabase `fweudhjkwrcoqvjvhwes` em `sa-east-1`, migrations `0001_initial.sql` e `0002_secure_trigger.sql` aplicadas.
- Worker `gabie-world-classifier` publicado, com segredo Bearer na Vercel.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` **já estão** em Production (confirmado: o botão "Entrar com Google" aparece habilitado na produção).

## Dois bloqueios, ambos precisam das suas mãos

Os dois envolvem criar/colar credenciais, então precisam ser feitos por você.

### 1. `GEMINI_API_KEY` não existe na Vercel

Confirmado pela própria API em produção:

```
GET https://www.gabie.space/api/prices?q=RTX%204060%20Ti
"sources":[{"name":"gemini-google-search","ok":false,"reason":"missing-key"}, ...]
```

Passos:

1. Abra https://aistudio.google.com/u/1/api-keys e crie uma chave `Gabie World Search` (projeto gratuito serve).
2. Vercel → projeto `gabie-world` → Settings → Environment Variables → `GEMINI_API_KEY`, marcada como **Sensitive**, ambiente **Production** apenas.
3. Redeploy.
4. Teste: `https://www.gabie.space/api/prices?q=RTX%204060%20Ti` deve responder `"source":"gemini-google-search"` com ofertas reais.

Se o Google repetir "The request is suspicious": tente em janela normal (não anônima), com uma só conta Google logada, e use um projeto **já existente** em vez de criar um novo.

### 2. Provider Google desligado no Supabase

Confirmado:

```
GET https://fweudhjkwrcoqvjvhwes.supabase.co/auth/v1/authorize?provider=google
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

Passos:

1. Google Cloud Console → credenciais OAuth 2.0 (Web application).
   - Authorized redirect URI: `https://fweudhjkwrcoqvjvhwes.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Providers → Google → habilitar e colar Client ID/Secret.
3. Supabase → Authentication → URL Configuration:
   - Site URL: `https://www.gabie.space`
   - Redirect URLs: `https://www.gabie.space/auth/callback` e `http://localhost:3000/auth/callback`

Enquanto isso não for feito, **nada do fluxo autenticado pode ser testado** — login, sincronização, migração guest → conta, compartilhamento e admin dependem todos disso.

Nunca cole essas chaves em commit, issue, chat público ou neste arquivo.

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

Na ordem, tudo depois do item 1 depende do login Google funcionando:

1. **Habilitar Google no Supabase** (bloqueio acima) e então exercitar de ponta a ponta: login, pull da conta, migração guest → conta, debounce de escrita, logout.
2. **Compartilhamento e permissões de colaborador.** O schema tem `shared_builds` + view `public_shared_builds`, mas **não existe** tabela de colaborador nem policy para acesso compartilhado. Precisa de migration nova (ex.: `build_collaborators(build_id,user_id,role)`) e ajuste das policies de `builds`/`build_items`, que hoje só permitem o dono.
3. **Admin e promoção de `SUPER_ADMIN`.** O enum `app_role` existe, mas nenhuma policy usa. `profiles` hoje só deixa a pessoa ler a si mesma, então um admin não enxerga ninguém. Promoção deve ser feita por função `security definer` com allowlist, nunca por update direto do cliente.
4. **Rota `/api/prices` persistindo histórico** em `price_checks`/`price_results` (as tabelas existem e estão vazias no fluxo atual).
5. **Cache e rate limit compartilhados.** Os atuais são por instância serverless; com tráfego real, mover para Supabase ou KV.
6. **Testes E2E das jornadas autenticadas e responsividade.**

## Verificações feitas

- `npm run lint`, `npm run typecheck`, `npm run build` — limpos a cada commit.
- Produção: `/api/prices` responde 200 com diagnóstico; `/auth/callback` redireciona; home e aba Perfil carregam sem erro de console.
- Local: empty state da busca renderizado e conferido no navegador.
- **Não verificado:** todo o caminho autenticado (bloqueio 2).

## Antes de continuar

`git status` tem alterações locais **não commitadas** em `design/` (`logo.svg`, `favicon.svg`, `preview.html`, `README.md` novo). São o design system da usuária — a logo do gatinho e os tokens exportados. Não descarte e não inclua em commits sem perguntar.
