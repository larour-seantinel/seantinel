const STRINGS = {
  en: {
    'index.tagline': 'Sea + sentinel \u2014 watching the coast as the ocean rises',
    'index.intro1': 'Seantinel stands watch on the coast \u2014 a quiet observer of how rising seas will reshape the places we live, swim, and walk.',
    'index.intro2': 'Pick a city below to step into a 3D view of its shoreline. Slide the sea level up and see what the ocean reaches \u2014 street by street, pier by pier, building by building.',
    'index.pick': 'Choose a city',
    'loc.california': 'California, USA',
    'loc.buenosaires': 'Buenos Aires, Argentina',

    'site.title_suffix': 'sea level',
    'site.loading': 'loading\u2026',
    'site.error': 'error loading data: ',
    'site.ready': 'Drag to look around. Use the slider to see how sea-level rise reshapes the coastline.',
    'site.slider_title': 'Sea-level<br/>rise',
    'site.you_are_here': 'You are here',
    'site.credit': 'Elevation: USGS 3DEP \u00b7 Imagery: USGS NAIP',

    'scenario.today': 'Today\u2019s sea level',
    'scenario.2050': 'Projected around 2050',
    'scenario.2100': 'Likely by 2100',
    'scenario.2100_high': 'High-end 2100 scenario',
    'scenario.ice_loss': '2100+ with ice-sheet loss',
    'scenario.worst': 'Beyond 2100 (worst case)',
  },
  es: {
    'index.tagline': 'Mar + centinela \u2014 vigilando la costa mientras sube el mar',
    'index.intro1': 'Seantinel vigila la costa \u2014 un observador silencioso de c\u00f3mo el ascenso del mar transformar\u00e1 los lugares donde vivimos, nadamos y caminamos.',
    'index.intro2': 'Elige una ciudad para entrar en una vista 3D de su costa. Sube el nivel del mar con el control deslizante y mira hasta d\u00f3nde llega el oc\u00e9ano \u2014 calle por calle, muelle por muelle, edificio por edificio.',
    'index.pick': 'Elige una ciudad',
    'loc.california': 'California, EE. UU.',
    'loc.buenosaires': 'Buenos Aires, Argentina',

    'site.title_suffix': 'nivel del mar',
    'site.loading': 'cargando\u2026',
    'site.error': 'error al cargar los datos: ',
    'site.ready': 'Arrastra para mirar alrededor. Usa el control deslizante para ver c\u00f3mo el ascenso del mar transforma la costa.',
    'site.slider_title': 'Ascenso<br/>del mar',
    'site.you_are_here': 'Est\u00e1s aqu\u00ed',
    'site.credit': 'Elevaci\u00f3n: USGS 3DEP \u00b7 Im\u00e1genes: USGS NAIP',

    'scenario.today': 'Nivel del mar actual',
    'scenario.2050': 'Proyectado hacia 2050',
    'scenario.2100': 'Probable para 2100',
    'scenario.2100_high': 'Escenario extremo 2100',
    'scenario.ice_loss': '2100+ con p\u00e9rdida de capas de hielo',
    'scenario.worst': 'M\u00e1s all\u00e1 de 2100 (peor caso)',
  },
};

const LANG_KEY = 'seantinel_lang';
const SUPPORTED = ['en', 'es'];

export function getLang() {
  const saved = (typeof localStorage !== 'undefined') ? localStorage.getItem(LANG_KEY) : null;
  if (saved && SUPPORTED.includes(saved)) return saved;
  const nav = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language.slice(0, 2).toLowerCase() : 'en';
  return SUPPORTED.includes(nav) ? nav : 'en';
}

export function setLang(lang) {
  if (!SUPPORTED.includes(lang)) return;
  localStorage.setItem(LANG_KEY, lang);
}

export function t(key) {
  const lang = getLang();
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
}

export function applyI18n(root = document) {
  const lang = getLang();
  if (root === document) document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
}

export function mountLangToggle(container) {
  const lang = getLang();
  const other = lang === 'en' ? 'es' : 'en';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lang-toggle';
  btn.textContent = other.toUpperCase();
  btn.title = other === 'es' ? 'Espa\u00f1ol' : 'English';
  btn.addEventListener('click', () => {
    setLang(other);
    location.reload();
  });
  container.appendChild(btn);
}
