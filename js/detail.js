// js/detail.js
import { getPokemon, listPokemon, listTypes } from "../api.js";
import { initTheme } from '../theme.js';

const detailEl = document.getElementById('detail');

// initialize shared theme behavior
try{ initTheme(); }catch(e){/* ignore */}

function getQuery(name){
  const u = new URL(window.location);
  return u.searchParams.get(name);
}

function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

async function getWeaknessesFromTypes(types){
  const set = new Set();
  await Promise.all(types.map(async t=>{
    try {
      const res = await fetch(t.type.url);
      if(!res.ok) return;
      const j = await res.json();
      j.damage_relations.double_damage_from.forEach(d => set.add(d.name.toLowerCase()));
    } catch(e){}
  }));
  return Array.from(set);
}

// Default Indonesian stat labels (used as fallback)
const STAT_LABELS = {
  hp: 'HP',
  attack: 'Serangan',
  defense: 'Pertahanan',
  'special-attack': 'Serangan Spesial',
  'special-defense': 'Pertahanan Spesial',
  speed: 'Kecepatan'
};

// Helper that returns translated text or null if translation is missing
function safeTr(key){
  try{
    if(!window.t) return null;
    const val = window.t(key);
    if(!val) return null;
    // if translator returns the key itself (no translation), treat as missing
    if(val === key) return null;
    return val;
  }catch(e){ return null; }
}

function statBarHtml(key, label, val){
  const pct = Math.min(100, Math.round(val));
  // include data-stat so we can update label on language change
  return `<div class="stat-row" data-stat="${key}">
    <div class="stat-name">${label}</div>
    <div class="stat-bar"><span style="width:${pct}%"></span></div>
    <div class="stat-val">${val}</div>
  </div>`;
}

async function buildEvolutionHtml(chainUrl, tr){
  try {
    const res = await fetch(chainUrl);
    if(!res.ok) return '';
    const j = await res.json();
    const list = [];
    let node = j.chain;
    while(node){
      list.push(node.species.name);
      node = (node.evolves_to && node.evolves_to[0]) ? node.evolves_to[0] : null;
    }
    const pokes = await Promise.all(list.map(n => getPokemon(n).catch(()=>null)));
    const items = pokes.map(p=>{
      if(!p) return '';
      const img = (p.sprites.other?.['official-artwork']?.front_default) || p.sprites.front_default || '';
      return `<div class="evo-item">
        <div class="evo-img"><img src="${img}" alt="${p.name}" onerror="this.style.display='none'"></div>
        <div class="evo-name">${capitalize(p.name)} <small>#${String(p.id).padStart(4,'0')}</small></div>
        <div class="evo-types">${p.types.map(t=>{
          const key = t.type.name;
          const label = (tr ? tr('type.' + key) : null) || capitalize(key);
          return `<span class="type small ${key}">${label}</span>`;
        }).join('')}</div>
      </div>`;
    });
    return `<div class="evolution-row">${items.join('<div class="evo-arrow">›</div>')}</div>`;
  } catch(e){
    return '';
  }
}

async function render(){
  const name = getQuery('name') || getQuery('id');
  if(!name){ if(detailEl) detailEl.innerHTML = '<p class="muted">Tidak ada Pokémon dipilih.</p>'; return; }

  if(detailEl) detailEl.innerHTML = '<p class="muted">Sedang memuat...</p>';
  try {
    const p = await getPokemon(name);
    let species = null;
    try {
      const spRes = await fetch(p.species.url);
      if(spRes.ok) species = await spRes.json();
    } catch(e){}

    // small translator helper with fallback
    const t = (k, fb) => safeTr(k) || fb || k;

    // determine UI language early so we can prefer species entries in that language
    let uiLang = 'en';
    try{
      const saved = localStorage.getItem('lang');
      if(saved) uiLang = saved;
      else uiLang = ( (navigator.language || navigator.userLanguage || 'en').startsWith('id') ) ? 'id' : 'en';
    } catch(e){ uiLang = 'en'; }
    console.debug('[detail] render() uiLang=', uiLang);

    const typesHtml = p.types.map(ti=>{
      const key = ti.type.name;
      const label = safeTr('type.' + key) || capitalize(key);
      return `<span class="type ${key}">${label}</span>`;
    }).join(' ');

    const weaknesses = await getWeaknessesFromTypes(p.types);
    const weaknessesHtml = weaknesses.map(w => {
      const label = safeTr('type.' + w) || capitalize(w);
      return `<span class="weakness">${label}</span>`;
    }).join(' ');
    // map statistik — prefer i18n if available, otherwise fallback to STAT_LABELS
    const statsHtml = p.stats.map(s => {
      const key = s.stat.name;
      const label = safeTr('stat.' + key) || STAT_LABELS[key] || capitalize(key);
      return statBarHtml(key, label, s.base_stat);
    }).join('');
    // choose species flavor text preferring UI language, otherwise fallback to English or first available
    let desc = '';
    let descSourceLang = '';
    if(species){
      const entries = species.flavor_text_entries || [];
      const entryUi = entries.find(e => e.language?.name === uiLang);
      if(entryUi?.flavor_text){
        desc = entryUi.flavor_text;
        descSourceLang = uiLang;
      } else {
        const entryEn = entries.find(e => e.language?.name === 'en');
        const first = entries[0];
        const pick = entryEn || first;
        if(pick){ desc = pick.flavor_text; descSourceLang = pick.language?.name || ''; }
      }
    }
    console.debug('[detail] chosen descSourceLang=', descSourceLang, 'desc length=', (desc||'').length);

    // Jika deskripsi bukan berbahasa Indonesia, coba terjemahkan otomatis (LibreTranslate public instance)
    // Generic translate helper using public LibreTranslate instance. Returns original text on failure.
    async function tryTranslate(text, srcLang, targetLang){
      if(!text) return text;
      if(!targetLang || srcLang === targetLang) return text;
      const endpoint = 'https://libretranslate.de/translate';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text, source: srcLang || 'auto', target: targetLang, format: 'text' })
        });
        if(!res.ok) return text;
        const j = await res.json();
        return j.translatedText || text;
      } catch (e) {
        return text;
      }
    }
    const genus = species ? ( (species.genera?.find(g=>g.language.name===uiLang)?.genus) || species.genera?.find(g=>g.language.name==='en')?.genus || '' ) : '';
    const genderRate = species ? species.gender_rate : -1;
    let genderText = 'Tidak diketahui';
    if(genderRate === -1) genderText = 'Tidak diketahui';
    else if(genderRate === 8) genderText = 'Tanpa jenis kelamin';
    else {
      const femalePct = (genderRate / 8) * 100;
      const malePct = 100 - femalePct;
      if(femalePct > malePct) genderText = 'Perempuan';
      else if(malePct > femalePct) genderText = 'Laki-laki';
      else genderText = 'Laki-laki / Perempuan';
    }

    let evoHtml = '';
    if(species?.evolution_chain?.url){
      evoHtml = await buildEvolutionHtml(species.evolution_chain.url, safeTr);
    }

    // choose description text according to current UI language
    let descToShow = desc.replace(/\n|\f/g,' ');
    try {
      // determine UI language: prefer saved lang in localStorage, otherwise detect browser
      let uiLang = 'en';
      try{
        const saved = localStorage.getItem('lang');
        if(saved) uiLang = saved;
        else uiLang = ( (navigator.language || navigator.userLanguage || 'en').startsWith('id') ) ? 'id' : 'en';
      } catch(e){ uiLang = 'en'; }
      // if description source language differs from UI language, try to translate to UI language
      if(desc && descSourceLang && uiLang && descSourceLang !== uiLang){
        console.debug('[detail] attempting translation from', descSourceLang, 'to', uiLang);
        const translated = await tryTranslate(descToShow, descSourceLang || 'auto', uiLang);
        console.debug('[detail] translation result length=', (translated||'').length);
        if(translated && translated !== descToShow){
          const note = (window.t && window.t('auto_translation_note')) || (uiLang === 'id' ? ' (terjemahan otomatis)' : ' (auto-translation)');
          descToShow = translated + note;
        }
      }
    } catch(e){ /* ignore translation failures */ }

    const img = (p.sprites.other?.['official-artwork']?.front_default) || p.sprites.front_default || '';

    if(!detailEl) return;

    detailEl.innerHTML = `
      <header class="detail-header">
        <h2 class="pokemon-title">${capitalize(p.name)} <small>#${String(p.id).padStart(4,'0')}</small></h2>
      </header>

      <div class="detail-grid">
        <div class="detail-left">
          <div class="image-wrap">
            <img id="pokemon-image" src="${img}" alt="${p.name}" class="sprite">
          </div>

          <div class="card stats-card">
            <h4>Statistik</h4>
            <div class="stats">${statsHtml}</div>
          </div>
        </div>

        <div class="detail-right">
          <p class="description">${descToShow}</p>

          <div class="versions">${t('versions','Version')}: <span class="version-dot blue"></span> <span class="version-dot red"></span></div>

          <aside class="info-box">
            <dl>
              <dt>${t('height','Height')}</dt><dd>${(p.height/10).toFixed(1)} m</dd>
              <dt>${t('weight','Weight')}</dt><dd>${(p.weight/10).toFixed(1)} kg</dd>
              <dt>${t('category','Category')}</dt><dd>${genus || '-'}</dd>
              <dt>${t('abilities','Abilities')}</dt><dd>${p.abilities.map(a=>capitalize(a.ability.name)+(a.is_hidden? ' ' + (safeTr('hidden') || '(hidden)'): '')).join(', ')}</dd>
              <dt>${t('gender','Gender')}</dt><dd>${genderText}</dd>
            </dl>
          </aside>

          <h3>${t('type','Type')}</h3>
          <div id="types" class="types">${typesHtml}</div>

          <h3>${t('weaknesses','Weaknesses')}</h3>
          <div id="weaknesses" class="weaknesses">${weaknessesHtml || '<span class="muted">-</span>'}</div>

          <div style="margin-top:12px">
            <button id="showMoves">${t('show_moves','Show Moves')} (${p.moves.length})</button>
            <div id="moves" style="margin-top:8px"></div>
          </div>
        </div>
      </div>

      ${evoHtml ? `<section class="evolution card"><h4>${t('evolution','Evolution')}</h4>${evoHtml}</section>` : ''}
    `;

    const showBtn = document.getElementById('showMoves');
    if(showBtn){
      showBtn.addEventListener('click', ()=>{
        const movesEl = document.getElementById('moves');
        if(movesEl) movesEl.innerHTML = '<ul>' + p.moves.slice(0,30).map(m=>`<li>${m.move.name}</li>`).join('') + '</ul>';
        showBtn.style.display = 'none';
      });
    }

    // update stat labels when language changes
    try {
      const updateStatLabels = () => {
        document.querySelectorAll('.stat-row').forEach(row => {
          const key = row.dataset.stat;
          if(!key) return;
          const newLabel = safeTr('stat.' + key) || STAT_LABELS[key] || capitalize(key);
          const nameEl = row.querySelector('.stat-name');
          if(nameEl) nameEl.textContent = newLabel;
        });
      };
      window.addEventListener('i18n:changed', updateStatLabels);
    } catch(e){ /* ignore */ }

    // Optional on-page debug panel to help diagnose description/i18n issues.
    try {
      const urlDebug = (new URL(window.location)).searchParams.get('debug') === '1';
      const storedDebug = localStorage.getItem('debug') === '1';
      if(urlDebug || storedDebug){
        const dbg = document.createElement('pre');
        dbg.className = 'detail-debug';
        dbg.style.whiteSpace = 'pre-wrap';
        dbg.style.background = 'rgba(0,0,0,0.6)';
        dbg.style.color = '#eee';
        dbg.style.padding = '8px';
        dbg.style.borderRadius = '6px';
        dbg.style.marginTop = '12px';
        const entries = (species && species.flavor_text_entries) ? species.flavor_text_entries.map(e=>({lang: e.language?.name, short: (e.flavor_text||'').replace(/\n|\f/g,' ').slice(0,160)})) : [];
        const debugObj = { uiLang, descSourceLang, descSample: (desc||'').replace(/\n|\f/g,' ').slice(0,300), entries };
        dbg.textContent = JSON.stringify(debugObj, null, 2);

        // container for debug + controls
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';

        // controls row
        const ctr = document.createElement('div');
        ctr.style.display = 'flex';
        ctr.style.gap = '8px';

        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy Debug';
        copyBtn.style.cursor = 'pointer';
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(dbg.textContent);
            copyBtn.textContent = 'Copied ✓';
            setTimeout(()=> copyBtn.textContent = 'Copy Debug', 1500);
          } catch(e){
            copyBtn.textContent = 'Copy Failed';
            console.error('Copy failed', e);
          }
        });

        const dlBtn = document.createElement('button');
        dlBtn.textContent = 'Download Debug';
        dlBtn.style.cursor = 'pointer';
        dlBtn.addEventListener('click', () => {
          try {
            const blob = new Blob([dbg.textContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = (p && p.name) ? p.name.replace(/[^a-z0-9_-]/gi,'') : 'pokemon';
            a.download = `detail-debug-${safeName}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } catch(e){ console.error('Download debug failed', e); }
        });

        ctr.appendChild(copyBtn);
        ctr.appendChild(dlBtn);

        container.appendChild(ctr);
        container.appendChild(dbg);

        const rightCol = detailEl.querySelector('.detail-right') || detailEl;
        rightCol.appendChild(container);
      }
    } catch(e){ /* ignore debug failures */ }

  } catch (err) {
    if(detailEl) detailEl.innerHTML = `<p class="muted">Gagal memuat detail.</p>`;
    console.error(err);
  }
}

render();

// load sidebar stats (total pokemon and types) similar to home.js
async function loadStats(){
  const totalEl = document.getElementById('totalCount');
  const typeEl = document.getElementById('typeCount');
  try{
    const p = await listPokemon(1,0);
    if(totalEl) totalEl.textContent = p.count || '--';
  }catch(e){ if(totalEl) totalEl.textContent = '--'; }
  try{
    const t = await listTypes();
    if(typeEl) typeEl.textContent = (t.count || (t.results && t.results.length)) || '--';
  }catch(e){ if(typeEl) typeEl.textContent = '--'; }
}

// run once to populate sidebar
loadStats();

// Ensure sidebar i18n labels update when language changes (fallback if i18n.js didn't update them)
function updateSidebarLabels(){
  try{
    if(!window.t) return;
    document.querySelectorAll('.stats-quick .muted[data-i18n]').forEach(el=>{
      const key = el.getAttribute('data-i18n');
      const txt = window.t(key) || el.textContent;
      el.textContent = txt;
    });
  }catch(e){/* ignore */}
}

// apply immediately and also when i18n changes
try{ updateSidebarLabels(); window.addEventListener('i18n:changed', updateSidebarLabels); }catch(e){/* ignore */}

// Re-render detail when language changes so dynamically generated text updates
try {
  window.addEventListener('i18n:changed', (e) => {
    // re-run render to update translations inside the detail container
    // don't await to avoid blocking the event handler
    try { render(); } catch(err){ console.error('Failed to re-render on i18n change', err); }
  });
} catch(e){ /* ignore if event system unavailable */ }