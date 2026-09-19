/**
 * Gabie World — controle de tema (claro / escuro / sistema)
 *
 * Espelha o que está no Figma:
 *  - as cores vivem na coleção "Color" com modos Light e Dark;
 *  - no CSS isso vira `:root` (claro) e `[data-theme="dark"]` (escuro);
 *  - sem escolha salva vale `prefers-color-scheme` — igual ao switch
 *    "Seguir o sistema" da tela 17 · Perfil e ajustes.
 *
 * O <html> sempre termina com data-theme="light" ou "dark", para que os
 * componentes não precisem repetir media queries.
 */

const STORAGE_KEY = 'gw-theme'; // 'light' | 'dark' | ausente = sistema
const mql = typeof matchMedia === 'function'
  ? matchMedia('(prefers-color-scheme: dark)')
  : null;

/** Preferência salva. Retorna 'system' quando a pessoa nunca escolheu. */
export function getPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch (e) {
    return 'system';
  }
}

/** Tema realmente pintado agora: 'light' ou 'dark'. */
export function getTheme() {
  const pref = getPreference();
  if (pref !== 'system') return pref;
  return mql && mql.matches ? 'dark' : 'light';
}

function paint(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  // combina com --gw-bg-page nos dois temas
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#09090B' : '#FFF9FB');
  document.dispatchEvent(new CustomEvent('gw:themechange', { detail: { theme: theme } }));
}

/**
 * Define a preferência. Passe 'system' para voltar a seguir o sistema —
 * é o que o switch "Seguir o sistema" faz quando é ligado.
 */
export function setPreference(pref) {
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch (e) {
    // modo privado ou storage bloqueado: só não persiste
  }
  paint(getTheme());
}

/** Alterna claro <-> escuro e fixa a escolha (sai do modo sistema). */
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setPreference(next);
  return next;
}

/**
 * Liga tudo. Chame uma vez no boot.
 * Continua reagindo ao SO enquanto a preferência for 'system'.
 */
export function initTheme() {
  paint(getTheme());

  if (mql) {
    const onSystemChange = function () {
      if (getPreference() === 'system') paint(getTheme());
    };
    if (mql.addEventListener) mql.addEventListener('change', onSystemChange);
    else mql.addListener(onSystemChange);
  }

  // qualquer elemento com [data-gw-theme-toggle] vira alternador
  document.addEventListener('click', function (e) {
    const el = e.target;
    const btn = el && el.closest ? el.closest('[data-gw-theme-toggle]') : null;
    if (btn) toggleTheme();
  });

  return getTheme();
}
