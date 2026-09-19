import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacidade", description: "O que o Gabie World guarda, onde guarda e como apagar." };

export default function Privacidade() {
  return (
    <LegalPage title="Política de Privacidade" updated="19 de setembro de 2026">
      <p>O Gabie World é um app pessoal e gratuito para planejar a montagem de um PC. Esta página descreve exatamente o que ele guarda — nada além disso.</p>

      <h2>Sem conta (modo convidado)</h2>
      <p>Se você usar sem entrar, <b>nada sai do seu navegador</b>. Suas builds, peças e avisos ficam no armazenamento local do próprio aparelho. Não há cadastro, não há envio para servidor e nós não temos acesso a esses dados. Limpar os dados do navegador apaga tudo.</p>

      <h2>Com conta Google</h2>
      <p>Ao entrar com o Google, recebemos dele apenas <b>seu nome e seu endereço de e-mail</b>. Não pedimos nem recebemos sua senha, seus contatos, seus arquivos ou qualquer outro dado da sua conta Google.</p>
      <p>A partir daí, ficam guardados no nosso banco de dados:</p>
      <ul>
        <li>nome e e-mail vindos do Google;</li>
        <li>as builds que você criar: nome, descrição e orçamento;</li>
        <li>as peças de cada build: categoria, produto, status, prioridade, preços e favoritos;</li>
        <li>os avisos gerados pelo próprio app.</li>
      </ul>
      <p>O banco fica na Supabase, em servidores no Brasil (região São Paulo). Cada conta só enxerga os próprios dados — isso é imposto pelo banco, não só pela tela.</p>

      <h2>Busca de preços</h2>
      <p>Quando você busca o preço de uma peça, o texto digitado é enviado à API do Google (Gemini) para procurar ofertas na web. Enviamos <b>somente o termo da busca</b> — seu nome, e-mail ou build não vão junto. O resultado é exibido na hora e não é associado à sua conta.</p>

      <h2>O que não fazemos</h2>
      <ul>
        <li>não vendemos, alugamos nem compartilhamos seus dados com ninguém;</li>
        <li>não exibimos anúncios;</li>
        <li>não usamos cookies de rastreamento ou analytics de terceiros;</li>
        <li>não criamos perfil de comportamento para publicidade.</li>
      </ul>
      <p>Usamos apenas os cookies necessários para manter você conectado após o login.</p>

      <h2>Apagar seus dados</h2>
      <p>Escreva para <a href="mailto:emailgg00@gmail.com">emailgg00@gmail.com</a> pedindo a exclusão. Apagamos a conta e tudo que estiver ligado a ela. Você também pode revogar o acesso do app a qualquer momento em <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</p>

      <h2>Mudanças</h2>
      <p>Se esta política mudar, a data no topo muda junto. Alterações relevantes serão avisadas dentro do app.</p>
    </LegalPage>
  );
}
