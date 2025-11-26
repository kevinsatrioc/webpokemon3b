// js/detail.js
import { getPokemon } from "../api.js";

const detailEl = document.getElementById('detail');

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
      j.damage_relations.double_damage_from.forEach(d => set.add(capitalize(d.name)));
    } catch(e){}
  }));
  return Array.from(set);
}

function statBarHtml(name, val){
  const pct = Math.min(100, Math.round(val));
  return `<div class="stat-row">
    <div class="stat-name">${capitalize(name)}</div>
    <div class="stat-bar"><span style="width:${pct}%"></span></div>
    <div class="stat-val">${val}</div>
  </div>`;
}

async function buildEvolutionHtml(chainUrl){
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
        <div class="evo-types">${p.types.map(t=>`<span class="type small ${t.type.name}">${capitalize(t.type.name)}</span>`).join('')}</div>
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

    const typesHtml = p.types.map(t=>`<span class="type ${t.type.name}">${capitalize(t.type.name)}</span>`).join(' ');
    const weaknesses = await getWeaknessesFromTypes(p.types);
    const weaknessesHtml = weaknesses.map(w => `<span class="weakness">${w}</span>`).join(' ');
    // map statistik ke Bahasa Indonesia
    const statNameMap = {
      hp: 'HP',
      attack: 'Serangan',
      defense: 'Pertahanan',
      'special-attack': 'Serangan Spesial',
      'special-defense': 'Pertahanan Spesial',
      speed: 'Kecepatan'
    };
    const statsHtml = p.stats.map(s => statBarHtml(statNameMap[s.stat.name] || s.stat.name, s.base_stat)).join('');
    // ambil deskripsi dalam bahasa Indonesia jika tersedia, fallback ke Inggris
    let desc = '';
    let descSourceLang = '';
    if(species){
      const entryId = species.flavor_text_entries?.find(e=>e.language.name==='id');
      const entryEn = species.flavor_text_entries?.find(e=>e.language.name==='en');
      if(entryId?.flavor_text){
        desc = entryId.flavor_text;
        descSourceLang = 'id';
      } else if(entryEn?.flavor_text){
        desc = entryEn.flavor_text;
        descSourceLang = 'en';
      } else {
        desc = species.flavor_text_entries?.[0]?.flavor_text || '';
        descSourceLang = species.flavor_text_entries?.[0]?.language?.name || '';
      }
    }

    // Jika deskripsi bukan berbahasa Indonesia, coba terjemahkan otomatis (LibreTranslate public instance)
    async function tryTranslateToId(text, srcLang){
      if(!text) return text;
      if(srcLang === 'id') return text;
      // Public LibreTranslate endpoint - bisa mengalami CORS atau rate-limit tergantung server
      const endpoint = 'https://libretranslate.de/translate';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text, source: srcLang || 'en', target: 'id', format: 'text' })
        });
        if(!res.ok) return text;
        const j = await res.json();
        return j.translatedText || text;
      } catch (e) {
        // jika gagal (CORS, network), fallback ke teks asli
        return text;
      }
    }
    const genus = species ? (species.genera?.find(g=>g.language.name==='id')?.genus || species.genera?.find(g=>g.language.name==='en')?.genus || '') : '';
    const genderRate = species ? species.gender_rate : -1;
    let genderText = 'Tidak diketahui';
    if(genderRate === -1) genderText = 'Tidak diketahui';
    else if(genderRate === 8) genderText = 'Tanpa jenis kelamin';
    else {
      const femalePct = (genderRate / 8) * 100;
      genderText = `♀ ${femalePct}% • ♂ ${100 - femalePct}%`;
    }

    let evoHtml = '';
    if(species?.evolution_chain?.url){
      evoHtml = await buildEvolutionHtml(species.evolution_chain.url);
    }

    // jika source bukan id, coba terjemahkan (non-blocking UI: await so user sees translated text)
    let descToShow = desc.replace(/\n|\f/g,' ');
    if(desc && descSourceLang !== 'id'){
      try {
        const translated = await tryTranslateToId(descToShow, descSourceLang || 'en');
        if(translated && translated !== descToShow) descToShow = translated + ' (terjemahan otomatis)';
      } catch(e){ /* ignore, use original */ }
    }

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

          <div class="versions">Versi: <span class="version-dot blue"></span> <span class="version-dot red"></span></div>

          <aside class="info-box">
            <dl>
              <dt>Tinggi</dt><dd>${(p.height/10).toFixed(1)} m</dd>
              <dt>Berat</dt><dd>${(p.weight/10).toFixed(1)} kg</dd>
              <dt>Kategori</dt><dd>${genus || '-'}</dd>
              <dt>Kemampuan</dt><dd>${p.abilities.map(a=>capitalize(a.ability.name)+(a.is_hidden? ' (tersembunyi)':'')).join(', ')}</dd>
              <dt>Jenis Kelamin</dt><dd>${genderText}</dd>
            </dl>
          </aside>

          <h3>Tipe</h3>
          <div id="types" class="types">${typesHtml}</div>

          <h3>Kelemahan</h3>
          <div id="weaknesses" class="weaknesses">${weaknessesHtml || '<span class="muted">-</span>'}</div>

          <div style="margin-top:12px">
            <button id="showMoves">Tampilkan Gerakan (${p.moves.length})</button>
            <div id="moves" style="margin-top:8px"></div>
          </div>
        </div>
      </div>

      ${evoHtml ? `<section class="evolution card"><h4>Evolusi</h4>${evoHtml}</section>` : ''}
    `;

    const showBtn = document.getElementById('showMoves');
    if(showBtn){
      showBtn.addEventListener('click', ()=>{
        const movesEl = document.getElementById('moves');
        if(movesEl) movesEl.innerHTML = '<ul>' + p.moves.slice(0,30).map(m=>`<li>${m.move.name}</li>`).join('') + '</ul>';
        showBtn.style.display = 'none';
      });
    }

  } catch (err) {
    if(detailEl) detailEl.innerHTML = `<p class="muted">Gagal memuat detail.</p>`;
    console.error(err);
  }
}

render();