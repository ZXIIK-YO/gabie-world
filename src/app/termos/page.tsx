import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Termos de Uso", description: "As regras simples de uso do Gabie World." };

export default function Termos() {
  return (
    <LegalPage title="Termos de Uso" updated="19 de setembro de 2026">
      <p>O Gabie World é um projeto pessoal, gratuito, feito para ajudar a planejar a montagem de um computador. Ao usar o app, você concorda com o seguinte.</p>

      <h2>O que o app é</h2>
      <p>Uma checklist de peças: você lista o que quer comprar, acompanha preços e vai marcando cada item conforme adquire. É só isso — não vendemos nada, não intermediamos compra e não recebemos comissão.</p>

      <h2>Preços e ofertas</h2>
      <p>Os preços exibidos vêm de uma busca automática na web e são <b>apenas indicativos</b>. Podem estar desatualizados, incorretos ou indisponíveis. Confira sempre no site da loja antes de comprar. Não somos responsáveis por nenhuma compra que você faça, nem pelo conteúdo, entrega ou atendimento das lojas encontradas.</p>

      <h2>Sua conta</h2>
      <p>O login é feito pelo Google. Você é responsável por manter sua conta Google segura. Use o app para o fim a que ele se destina e não tente sobrecarregá-lo, invadi-lo ou acessar dados de outras pessoas.</p>

      <h2>Seus dados</h2>
      <p>O conteúdo que você cria é seu. Não reivindicamos nenhum direito sobre suas builds. O tratamento dos dados está descrito na <a href="/privacidade">Política de Privacidade</a>.</p>

      <h2>Sem garantias</h2>
      <p>O app é oferecido &ldquo;como está&rdquo;. Fazemos o possível para mantê-lo funcionando, mas não garantimos disponibilidade contínua, ausência de erros nem preservação eterna dos dados. Guarde uma cópia do que for importante para você.</p>

      <h2>Encerramento</h2>
      <p>Você pode parar de usar quando quiser e pedir a exclusão da conta. Como é um projeto pessoal e sem custo, ele pode ser descontinuado — se isso acontecer, avisaremos com antecedência dentro do app.</p>

      <h2>Contato</h2>
      <p>Qualquer dúvida sobre estes termos: <a href="mailto:emailgg00@gmail.com">emailgg00@gmail.com</a>.</p>
    </LegalPage>
  );
}
