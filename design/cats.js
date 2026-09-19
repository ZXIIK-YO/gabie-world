/**
 * Gabie World — reaction cats
 *
 * Um gato por significado. Regras do design system: no máximo um gato
 * visível por dobra, sempre dentro da bolha circular com anel claro,
 * nunca em card de lista nem como ícone funcional.
 * O mapa completo está na página "😺 Cat System" do Figma.
 */

export const CATS = {
  curious:    { label: 'Curioso',            role: 'descoberta',      usage: 'Busca, comparação, onboarding, explorar categorias' },
  happy:      { label: 'Feliz',              role: 'sucesso',         usage: 'Confirmação, peça comprada, progresso saudável' },
  ecstatic:   { label: 'Extremamente feliz', role: 'celebracao',      usage: 'Preço alvo atingido, build 100%, marco grande' },
  flowers:    { label: 'Com flores',         role: 'carinho',         usage: 'Compartilhar build, agradecer, página pública' },
  pleading:   { label: 'Com peninha',        role: 'incentivo',       usage: 'Dica carinhosa, convite gentil, lembrete de favoritar' },
  shy:        { label: 'Tímido',             role: 'primeiro-acesso', usage: 'Empty state inicial, conta nova, nada criado ainda' },
  sleeping:   { label: 'Dormindo',           role: 'silencio',        usage: 'Sem avisos, sem atividade, lista vazia' },
  tired:      { label: 'Cansado',            role: 'espera',          usage: 'Loading longo, busca em várias lojas' },
  suspicious: { label: 'Suspeito',           role: 'atencao',         usage: 'Possível incompatibilidade, margem apertada' },
  sad:        { label: 'Triste',             role: 'frustracao',      usage: 'Nenhum resultado, peça cara demais, oferta acabou' },
  crying:     { label: 'Chorando',           role: 'orcamento',       usage: 'Orçamento estourado, preço subiu' },
  indignant:  { label: 'Indignado',          role: 'incompativel',    usage: 'Peça que não encaixa, conflito de specs' },
  angry:      { label: 'Zangado',            role: 'erro',            usage: 'Falha de operação, ação bloqueada, sem conexão' }
};

/** Onde os arquivos moram. Ajuste se mover a pasta data/. */
export const CAT_BASE = '/data/cats';

/**
 * Caminhos de um gato, já escolhendo a variante @256 para tamanhos pequenos
 * (todos os usos do design cabem em 256, menos o empty state de 134px que
 * ainda fica nítido em telas 2x).
 */
export function catSrc(slug, size) {
  if (!CATS[slug]) throw new Error('Gato desconhecido: ' + slug);
  const file = (size || 64) <= 128 ? 'cat-' + slug + '@256' : 'cat-' + slug;
  return {
    webp: CAT_BASE + '/webp/' + file + '.webp',
    png: CAT_BASE + '/png/' + file + '.png'
  };
}

/**
 * Markup pronto. WebP com fallback PNG — o WebP é ~15x menor; o PNG existe
 * porque fill de WebP não renderiza dentro do Figma.
 * Gatos são decorativos: sem alt, marque aria-hidden (é o default aqui).
 */
export function catPicture(slug, size, alt) {
  const s = size || 64;
  const src = catSrc(slug, s);
  const a11y = alt ? 'alt="' + alt + '"' : 'alt="" aria-hidden="true"';
  return [
    '<picture class="gw-cat" style="--gw-cat-size:' + s + 'px">',
    '  <source srcset="' + src.webp + '" type="image/webp">',
    '  <img src="' + src.png + '" width="' + s + '" height="' + s + '" ' + a11y + ' loading="lazy" decoding="async">',
    '</picture>'
  ].join('\n');
}
