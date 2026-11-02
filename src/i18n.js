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

    'credit.by': 'A project by Dr. Eric Larour & Guillermo Anselmo Vezzosi',
    'credit.contact': 'Contact',

    'scenario.today': 'Today\u2019s sea level',
    'scenario.2050': 'Projected around 2050',
    'scenario.2100': 'Likely by 2100',
    'scenario.2100_high': 'High-end 2100 scenario',
    'scenario.ice_loss': '2100+ with ice-sheet loss',
    'scenario.worst': 'Beyond 2100 (worst case)',

    'data.teaser': 'Data & credits \u25b8',
    'data.title': 'Data sources & credits',
    'data.sources_header': 'Data sources',
    'data.elev': 'Elevation: USGS 3DEP (CONUS) \u00b7 Copernicus GLO-30 (global)',
    'data.imagery': 'Imagery: Esri World Imagery',
    'data.buildings': 'Buildings: OpenStreetMap footprints \u00b7 heights from USGS 3DEP lidar HAG where available (CONUS)',
    'data.rendering': 'Rendering: Three.js',
    'data.credits_header': 'Credits',
    'disclaimer.teaser': '\u26a0 Disclaimer',
    'disclaimer.title': 'Disclaimer',
    'disclaimer.close': 'Close',
    'disclaimer.p1': '<b>The water level in this visualization is set by the slider and does not represent any sea-level projection, scenario, or forecast</b> from the IPCC, NOAA, NASA, or any other scientific body. No endorsement by any of these organizations is implied.',
    'disclaimer.p2': '<b>What is not modeled.</b> This view omits tides, storm surge, wind waves and runup, pluvial or fluvial flooding, hydrodynamic flow of water across the terrain, groundwater, vertical land motion including glacial isostatic adjustment and anthropogenic subsidence, coastal and inland flood defenses (levees, seawalls, pumps), bathymetry, erosion, sediment transport, and future development. Terrain elevations come from a static digital elevation model referenced to its native vertical datum, which is not identical to local mean sea level or any specific tidal datum. Building footprints are from crowdsourced OpenStreetMap data; heights are estimated from publicly available lidar where available and from defaults otherwise. All source data is used as-is from third parties, including USGS 3DEP, Copernicus, OpenStreetMap, Microsoft Planetary Computer, and Esri World Imagery.',
    'disclaimer.p3': '<b>No warranty, no reliance.</b> This site is provided for public outreach and educational purposes only, "as is" and "as available," without warranty of any kind, express or implied, including warranties of accuracy, completeness, fitness for a particular purpose, non-infringement, or merchantability. Nothing shown here constitutes engineering, planning, legal, financial, insurance, real estate, emergency management, or policy advice. Do not rely on this visualization for any decision concerning real property, safety, insurance, construction, land use, environmental compliance, or public policy. The authors, their employers, and any affiliated institutions disclaim all liability for any direct, indirect, incidental, consequential, or special damages arising from use of or reliance on this site. By using this site, you accept these terms.',
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

    'credit.by': 'Un proyecto de Dr. Eric Larour y Guillermo Anselmo Vezzosi',
    'credit.contact': 'Contacto',

    'scenario.today': 'Nivel del mar actual',
    'scenario.2050': 'Proyectado hacia 2050',
    'scenario.2100': 'Probable para 2100',
    'scenario.2100_high': 'Escenario extremo 2100',
    'scenario.ice_loss': '2100+ con p\u00e9rdida de capas de hielo',
    'scenario.worst': 'M\u00e1s all\u00e1 de 2100 (peor caso)',

    'data.teaser': 'Datos y cr\u00e9ditos \u25b8',
    'data.title': 'Fuentes de datos y cr\u00e9ditos',
    'data.sources_header': 'Fuentes de datos',
    'data.elev': 'Elevaci\u00f3n: USGS 3DEP (EE. UU.) \u00b7 Copernicus GLO-30 (global)',
    'data.imagery': 'Im\u00e1genes: Esri World Imagery',
    'data.buildings': 'Edificios: huellas de OpenStreetMap \u00b7 alturas desde USGS 3DEP lidar HAG cuando est\u00e1 disponible (EE. UU.)',
    'data.rendering': 'Renderizado: Three.js',
    'data.credits_header': 'Cr\u00e9ditos',
    'disclaimer.teaser': '\u26a0 Aviso legal',
    'disclaimer.title': 'Aviso legal',
    'disclaimer.close': 'Cerrar',
    'disclaimer.p1': '<b>El nivel del agua en esta visualizaci\u00f3n lo fija el control deslizante y no representa ninguna proyecci\u00f3n, escenario ni pron\u00f3stico de nivel del mar</b> del IPCC, NOAA, NASA ni de ning\u00fan otro organismo cient\u00edfico. No se implica el respaldo de ninguna de estas organizaciones.',
    'disclaimer.p2': '<b>Lo que no se modela.</b> Esta vista omite mareas, marejadas ciclónicas, oleaje y runup, inundaciones pluviales y fluviales, flujo hidrodin\u00e1mico del agua sobre el terreno, aguas subterr\u00e1neas, movimiento vertical del terreno incluyendo ajuste isost\u00e1tico glacial y subsidencia antropog\u00e9nica, defensas costeras e interiores contra inundaciones (diques, malecones, bombas), batimetr\u00eda, erosi\u00f3n, transporte de sedimentos y desarrollo urbano futuro. Las elevaciones del terreno provienen de un modelo digital de elevaci\u00f3n est\u00e1tico referido a su datum vertical nativo, que no es id\u00e9ntico al nivel medio del mar local ni a ning\u00fan datum mareal espec\u00edfico. Las huellas de los edificios provienen de datos colaborativos de OpenStreetMap; las alturas se estiman a partir de LiDAR p\u00fablico cuando est\u00e1 disponible y a partir de valores por defecto en caso contrario. Todos los datos de origen se utilizan tal cual, provenientes de terceros, incluidos USGS 3DEP, Copernicus, OpenStreetMap, Microsoft Planetary Computer y Esri World Imagery.',
    'disclaimer.p3': '<b>Sin garant\u00eda, sin dependencia.</b> Este sitio se proporciona \u00fanicamente con fines de divulgaci\u00f3n p\u00fablica y educativos, \u00abtal cual\u00bb y \u00absujeto a disponibilidad\u00bb, sin garant\u00edas de ning\u00fan tipo, expresas o impl\u00edcitas, incluidas las de exactitud, integridad, idoneidad para un fin determinado, no infracci\u00f3n o comerciabilidad. Nada de lo mostrado aqu\u00ed constituye asesoramiento de ingenier\u00eda, planificaci\u00f3n, legal, financiero, de seguros, inmobiliario, de gesti\u00f3n de emergencias o de pol\u00edticas p\u00fablicas. No conf\u00ede en esta visualizaci\u00f3n para decisiones relacionadas con bienes inmuebles, seguridad, seguros, construcci\u00f3n, uso del suelo, cumplimiento ambiental o pol\u00edticas p\u00fablicas. Los autores, sus empleadores y cualquier instituci\u00f3n afiliada rechazan toda responsabilidad por da\u00f1os directos, indirectos, incidentales, consecuentes o especiales derivados del uso o la confianza en este sitio. Al usar este sitio, usted acepta estos t\u00e9rminos.',
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
