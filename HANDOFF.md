# Gabie World — handoff

Atualizado em 18/09/2026. Não há segredos neste arquivo.

## Estado atual

- Produção: https://www.gabie.space
- Repositório: https://github.com/ZXIIK-YO/gabie-world
- Next.js 16.3, Supabase, Vercel e Cloudflare Workers AI configurados.
- Supabase `fweudhjkwrcoqvjvhwes` em `sa-east-1`, migrations `0001_initial.sql` e `0002_secure_trigger.sql` aplicadas.
- Worker `gabie-world-classifier` publicado em `gabie-world-classifier.kyo-gabie-world.workers.dev` com segredo Bearer na Vercel.
- A rota `/api/prices` está preparada para Gemini 2.5 Flash-Lite com Google Search grounding e usa Mercado Livre como fallback.

## Bloqueio atual

O Google AI Studio recusou automaticamente a criação de um novo projeto e de uma nova chave com a mensagem “The request is suspicious”. A conta já está autenticada e permanece no nível gratuito.

Passo manual necessário:

1. Abra https://aistudio.google.com/u/1/api-keys.
2. Crie uma chave chamada `Gabie World Search` (pode usar o projeto gratuito existente).
3. Na Vercel, projeto `gabie-world`, crie a variável secreta `GEMINI_API_KEY` em Production.
4. Faça um redeploy e teste `https://www.gabie.space/api/prices?q=RTX%204060%20Ti`.

Nunca cole a chave em commit, issue, chat público ou neste arquivo.

## Ainda falta para o escopo completo

- Concluir login Google no Supabase (OAuth credentials e redirect URLs).
- Conectar UI ao Supabase para perfis, projetos, listas, histórico e migração guest → conta.
- Implementar compartilhamento persistente e permissões de colaborador.
- Implementar painel de administração e promover `SUPER_ADMIN` com segurança.
- Validar a qualidade/limites reais da busca Gemini e ajustar prompts, rate limiting e cache.
- Testes E2E completos das jornadas autenticadas e responsividade final.

## Verificações já feitas

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Produção e domínio customizado abertos no navegador.

Antes de continuar, confira `git status`: há alterações de design locais do usuário que não devem ser descartadas (`design/`).
