// js/i18n.js
// Small i18n helper used across pages. Exposes `window.t(key)` and handles lang buttons.
(function(){
  const I18N = {
    en: {
      nav_home: 'PokemonREST', nav_detail: 'Detail', nav_about: 'About', nav_language: 'Language',
      back: '← Back',
      stat_title: 'Statistics', versions: 'Version',
      height: 'Height', weight: 'Weight', category: 'Category', abilities: 'Abilities', gender: 'Gender',
      type: 'Type', weaknesses: 'Weaknesses', show_moves: 'Show Moves', evolution: 'Evolution',
      hidden: '(hidden)'
    },
    id: {
      nav_home: 'PokemonREST', nav_detail: 'Detail', nav_about: 'Tentang', nav_language: 'Bahasa',
      back: '← Kembali',
      stat_title: 'Statistik', versions: 'Versi',
      height: 'Tinggi', weight: 'Berat', category: 'Kategori', abilities: 'Kemampuan', gender: 'Jenis Kelamin',
      type: 'Tipe', weaknesses: 'Kelemahan', show_moves: 'Tampilkan Gerakan', evolution: 'Evolusi',
      hidden: '(tersembunyi)'
    }
  };

  // sidebar small labels for totals (used on home/detail/about)
  I18N.en = Object.assign(I18N.en || {}, { 'label_total': 'Total Pokemon', 'label_types': 'Types' });
  I18N.id = Object.assign(I18N.id || {}, { 'label_total': 'Jumlah Pokemon', 'label_types': 'Tipe' });

  // note shown when a description was auto-translated
  I18N.en['auto_translation_note'] = ' (auto-translation)';
  I18N.id['auto_translation_note'] = ' (terjemahan otomatis)';

  // Type translations (common Pokemon types)
  Object.assign(I18N.en, {
    'type.grass':'Grass','type.poison':'Poison','type.fire':'Fire','type.water':'Water','type.bug':'Bug','type.flying':'Flying','type.ice':'Ice','type.ground':'Ground','type.psychic':'Psychic','type.rock':'Rock','type.ghost':'Ghost','type.dragon':'Dragon','type.dark':'Dark','type.steel':'Steel','type.fairy':'Fairy','type.electric':'Electric','type.normal':'Normal','type.fighting':'Fighting'
  });
  Object.assign(I18N.id, {
    'type.grass':'Rumput','type.poison':'Racun','type.fire':'Api','type.water':'Air','type.bug':'Serangga','type.flying':'Terbang','type.ice':'Es','type.ground':'Tanah','type.psychic':'Psikis','type.rock':'Batu','type.ghost':'Hantu','type.dragon':'Naga','type.dark':'Gelap','type.steel':'Baja','type.fairy':'Peri','type.electric':'Listrik','type.normal':'Normal','type.fighting':'Pertarungan'
  });

  function getSavedLang(){ try{ return localStorage.getItem('lang'); }catch(e){return null} }
  function setSavedLang(l){ try{ localStorage.setItem('lang', l); }catch(e){} }

  function getBrowserLang(){ return (navigator.language || navigator.userLanguage || 'en').startsWith('id') ? 'id' : 'en'; }

  function applyLang(lang){
    if(!lang) return;
    setSavedLang(lang);
    // update elements marked with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const txt = (I18N[lang] && I18N[lang][key]) || (I18N['en'] && I18N['en'][key]) || key;
      el.textContent = txt;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const txt = (I18N[lang] && I18N[lang][key]) || '';
      if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = txt;
    });
    document.querySelectorAll('.lang-btn').forEach(b=> b.classList.toggle('active', b.dataset.lang === lang));
  }

  // expose translator function
  window.t = function(key){
    const lang = getSavedLang() || getBrowserLang();
    return (I18N[lang] && I18N[lang][key]) || (I18N['en'] && I18N['en'][key]) || key;
  };

  // init: set default language and wire buttons
  const initial = getSavedLang() || getBrowserLang();
  document.addEventListener('DOMContentLoaded', ()=>{
    applyLang(initial);
  });

  document.addEventListener('click', (e)=>{
    if(e.target && e.target.classList && e.target.classList.contains('lang-btn')){
      const lang = e.target.dataset.lang;
      applyLang(lang);
      // reload to let pages re-render language-specific content if needed
      // but don't force reload; dispatch a custom event instead
      window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
    }
  });
})();
