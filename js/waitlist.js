/* MACRO'S Early Access: modulo della lista d'attesa (landing/v2/index.html, sezione #early-access).
   Parla solo con la Edge Function «waitlist» (server/supabase/functions/waitlist): nessuna tabella è leggibile dal browser,
   nessuna chiave segreta qui (la chiave anon è pubblica per costruzione). Le città vengono da js/waitlist-cities.js,
   generato da tools/waitlist_cities.py: il server accetta solo quegli id. */
(function(){
  'use strict';
  var CFG = window.WAITLIST_CONFIG || {};
  var ENDPOINT = CFG.endpoint || '';
  var REGIONS = window.WAITLIST_REGIONS || [], PROVS = window.WAITLIST_PROVINCES || [];
  var CITIES = (window.WAITLIST_COMUNI || []).map(function(c){
    var p = PROVS[c[2]] || ['', '', 0], region = REGIONS[p[2]] || '';
    return {id:c[0], name:c[1], sigla:p[0], province:p[1], region:region, cap:c[3] === 1, fname:fold(c[1])};
  });
  var BY_ID = {}; CITIES.forEach(function(c){ BY_ID[c.id] = c; });

  /* ---------- misura anonima (nessun cookie, nessun dato personale; rispetta Do Not Track e Global Privacy Control) ---------- */
  var noTrack = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  function store(get, k, v){ try{ return get ? sessionStorage.getItem(k) : sessionStorage.setItem(k, v); }catch(e){ return null; } }
  var session = store(true, 'wl_session');
  if(!session){ session = Array.from(crypto.getRandomValues(new Uint8Array(12)), function(b){ return (b % 36).toString(36); }).join(''); store(false, 'wl_session', session); }
  // provenienza: parametri utm della prima pagina della visita (restano anche navigando nella landing)
  var utm = {};
  try{ utm = JSON.parse(store(true, 'wl_utm') || 'null') || {}; }catch(e){ utm = {}; }
  (function(){
    var q = new URLSearchParams(location.search), any = false, u = {};
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function(k){ var v = (q.get(k) || '').trim().slice(0, 120); if(v){ u[k] = v; any = true; } });
    if(any){ utm = u; store(false, 'wl_utm', JSON.stringify(u)); }
    if(!utm.referrer && document.referrer){
      try{ var h = new URL(document.referrer).hostname; if(h && h !== location.hostname){ utm.referrer = h.slice(0, 120); store(false, 'wl_utm', JSON.stringify(utm)); } }catch(e){}
    }
  })();

  function post(body){
    return fetch(ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json', 'apikey':CFG.anonKey || ''},
      body:JSON.stringify(body), keepalive: body.action === 'event'});
  }
  function track(type, extra){
    if(!ENDPOINT || noTrack) return;
    if(store(true, 'wl_ev_' + type)) return;   // una volta per visita
    store(false, 'wl_ev_' + type, '1');
    post(Object.assign({action:'event', type:type, session:session, source:'landing',
      utm_source:utm.utm_source, utm_medium:utm.utm_medium, utm_campaign:utm.utm_campaign}, extra || {})).catch(function(){});
  }
  track('visit');

  var form = document.getElementById('wl-form');
  if(!form) return;
  var loadedAt = Date.now();

  /* ---------- città: ricerca con suggerimenti (combobox ARIA) ---------- */
  function fold(s){ return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' '); }
  var input = document.getElementById('wl-city'), list = document.getElementById('wl-city-list'), hidden = document.getElementById('wl-city-id');
  var chosen = document.getElementById('wl-city-chosen'), chips = document.getElementById('wl-city-chips');
  var active = -1, shown = [];

  function label(c){ return c.name + ' (' + c.sigla + ')'; }
  /* nome esatto, poi «inizia con», poi «contiene»; a parità prima i capoluoghi. «Samone TO» o «Samone (TO)» filtra per sigla */
  function search(q){
    q = fold(q.trim()).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    if(!q) return [];
    var m = /^(.*?)\s+([a-z]{2})$/.exec(q), sigla = null;
    if(m && PROVS.some(function(p){ return p[0].toLowerCase() === m[2]; })){ q = m[1]; sigla = m[2].toUpperCase(); }
    var exact = [], starts = [], inside = [];
    for(var i = 0; i < CITIES.length; i++){
      var c = CITIES[i];
      if(sigla && c.sigla !== sigla) continue;
      if(c.fname === q) exact.push(c);
      else if(c.fname.indexOf(q) === 0) starts.push(c);
      else if(q.length >= 3 && c.fname.indexOf(q) > 0) inside.push(c);
    }
    var byCap = function(a, b){ return (b.cap - a.cap) || a.name.length - b.name.length; };
    return exact.sort(byCap).concat(starts.sort(byCap), inside.sort(byCap)).slice(0, 8);
  }
  function render(){
    list.innerHTML = '';
    shown.forEach(function(c, i){
      var li = document.createElement('li');
      li.id = 'wl-opt-' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === active ? 'true' : 'false');
      li.dataset.id = c.id;
      li.innerHTML = '<b></b><span></span>';
      li.firstChild.textContent = c.name;
      li.lastChild.textContent = c.province + ' · ' + c.region;
      li.addEventListener('mousedown', function(e){ e.preventDefault(); pick(c); });
      list.appendChild(li);
    });
    var open = shown.length > 0;
    list.hidden = !open;
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(active >= 0) input.setAttribute('aria-activedescendant', 'wl-opt-' + active); else input.removeAttribute('aria-activedescendant');
    var hint = document.getElementById('wl-city-none');
    hint.hidden = !(input.value.trim().length >= 2 && !shown.length && !hidden.value);
  }
  function pick(c){
    hidden.value = c.id;
    input.value = label(c);
    shown = []; active = -1; render();
    chosen.textContent = c.province + ' · ' + c.region;
    chosen.hidden = false;
    chips.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.id === c.id ? 'true' : 'false'); });
    setError('city', '');
  }
  input.addEventListener('input', function(){
    hidden.value = ''; chosen.hidden = true;
    chips.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', 'false'); });
    shown = search(input.value); active = shown.length ? 0 : -1; render();
  });
  input.addEventListener('keydown', function(e){
    if(e.key === 'ArrowDown' && shown.length){ e.preventDefault(); active = (active + 1) % shown.length; render(); }
    else if(e.key === 'ArrowUp' && shown.length){ e.preventDefault(); active = (active - 1 + shown.length) % shown.length; render(); }
    else if(e.key === 'Enter' && shown.length && active >= 0){ e.preventDefault(); pick(shown[active]); }
    else if(e.key === 'Escape' && shown.length){ shown = []; active = -1; render(); }
  });
  input.addEventListener('blur', function(){
    setTimeout(function(){
      // testo uguale a un capoluogo (anche senza toccare il suggerimento): lo si sceglie; altrimenti resta da scegliere
      // un solo comune con quel nome esatto (senza omonimi): lo si sceglie anche senza toccare il suggerimento
      if(!hidden.value){ var r = search(input.value), same = r.filter(function(c){ return c.fname === r[0].fname; }); if(r.length && fold(input.value.replace(/\s*\([A-Z]{2}\)\s*$/, '').trim()) === r[0].fname && same.length === 1) pick(r[0]); }
      shown = []; active = -1; render();
    }, 120);
  });
  (window.WAITLIST_FEATURED || []).forEach(function(id){
    var c = BY_ID[id]; if(!c) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'wl-chip'; b.dataset.id = id; b.textContent = c.name; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function(){ pick(c); });
    chips.appendChild(b);
  });

  /* ---------- controlli e invio ---------- */
  var emailEl = document.getElementById('wl-email'), privacyEl = document.getElementById('wl-privacy'), mktEl = document.getElementById('wl-marketing');
  var btn = document.getElementById('wl-submit'), status = document.getElementById('wl-status');
  var EMAIL_RE = /^[^@\s]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/;

  function setError(field, msg){
    var el = document.getElementById('wl-err-' + field), ctl = field === 'email' ? emailEl : field === 'city' ? input : privacyEl;
    el.textContent = msg; el.hidden = !msg;
    ctl.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function validate(){
    var ok = true, first = null;
    var email = emailEl.value.trim().toLowerCase();
    if(!email){ setError('email', 'Inserisci la tua email.'); ok = false; first = first || emailEl; }
    else if(!EMAIL_RE.test(email) || email.length > 254){ setError('email', 'Controlla l\'email: sembra incompleta o scritta male.'); ok = false; first = first || emailEl; }
    else setError('email', '');
    if(!hidden.value || !BY_ID[hidden.value]){ setError('city', 'Scegli una città dall\'elenco.'); ok = false; first = first || input; }
    else setError('city', '');
    if(!privacyEl.checked){ setError('privacy', 'Per iscriverti devi confermare di aver letto l\'informativa privacy.'); ok = false; first = first || privacyEl; }
    else setError('privacy', '');
    if(first) first.focus();
    return ok;
  }
  form.addEventListener('focusin', function(){ track('form_start'); });
  emailEl.addEventListener('blur', function(){ if(emailEl.value.trim()) emailEl.value = emailEl.value.trim().toLowerCase(); });

  function showStatus(kind, html){
    status.className = 'wl-status wl-' + kind;
    status.innerHTML = html;
    status.hidden = false;
  }
  function busy(on){
    btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false');
    btn.querySelector('.wl-btn-label').textContent = on ? 'Invio in corso…' : 'Riserva il tuo 10%';
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    status.hidden = true;
    if(!validate()) return;
    if(!ENDPOINT){ showStatus('error', 'Il servizio di iscrizione non è ancora attivo. Riprova più tardi.'); return; }
    busy(true);
    var email = emailEl.value.trim().toLowerCase(), city = BY_ID[hidden.value];
    post({action:'subscribe', email:email, city_id:city.id, privacy:true, marketing:mktEl.checked,
      website:document.getElementById('wl-website').value, elapsed_ms:Date.now() - loadedAt, session:session, source:'landing',
      utm_source:utm.utm_source, utm_medium:utm.utm_medium, utm_campaign:utm.utm_campaign, referrer:utm.referrer})
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ return {status:r.status, data:d}; }); })
      .then(function(res){
        busy(false);
        if(res.status === 200 && res.data.ok){
          form.classList.add('wl-done');
          var where = '<b>' + escapeHtml(city.name) + '</b>';
          if(res.data.email === 'sent'){
            showStatus('ok', '<strong>Controlla la tua email.</strong> Ti abbiamo scritto all\'indirizzo inserito: apri il link per confermare l\'iscrizione e riservare il 10% per ' + where + '. Se non la trovi, guarda anche nella posta indesiderata.' +
              '<button type="button" class="wl-link" id="wl-resend">Non è arrivata? Inviala di nuovo</button>');
            bindResend(email);
          } else {
            showStatus('warn', '<strong>Richiesta ricevuta, ma l\'email di conferma non è partita.</strong> L\'invio delle email non è ancora attivo: l\'iscrizione resta in attesa e diventa valida solo dopo la conferma. Riprova tra qualche giorno con lo stesso indirizzo.');
          }
          status.focus();
          return;
        }
        if(res.status === 422){
          var f = res.data.error;
          if(f === 'email') setError('email', 'Controlla l\'email: sembra incompleta o scritta male.');
          else if(f === 'city' || f === 'invalid') setError('city', 'Scegli una città dall\'elenco.');
          else if(f === 'privacy') setError('privacy', 'Per iscriverti devi confermare di aver letto l\'informativa privacy.');
          else showStatus('error', 'Controlla i dati inseriti e riprova.');
          return;
        }
        if(res.status === 429){ showStatus('error', 'Troppi tentativi in poco tempo. Riprova tra qualche minuto.'); return; }
        showStatus('error', 'Al momento non riusciamo a completare l\'iscrizione. È un problema temporaneo: riprova tra poco.');
      })
      .catch(function(){ busy(false); showStatus('error', 'Non riusciamo a raggiungere il servizio di iscrizione. Controlla la connessione e riprova tra poco.'); });
  });

  function bindResend(email){
    var b = document.getElementById('wl-resend'); if(!b) return;
    var wait = 60;
    b.disabled = true;
    var t = setInterval(function(){ wait--; b.textContent = wait > 0 ? 'Puoi richiederla di nuovo tra ' + wait + ' s' : 'Non è arrivata? Inviala di nuovo'; if(wait <= 0){ clearInterval(t); b.disabled = false; } }, 1000);
    b.addEventListener('click', function(){
      b.disabled = true; b.textContent = 'Invio in corso…';
      post({action:'resend', email:email}).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ return {status:r.status, data:d}; }); })
        .then(function(res){
          b.textContent = res.status === 200 && res.data.email === 'sent' ? 'Fatto: se l\'iscrizione è in attesa, ti abbiamo inviato una nuova email.' :
            res.status === 429 ? 'Troppi tentativi: riprova più tardi.' : 'Non è stato possibile inviarla adesso: riprova più tardi.';
        }).catch(function(){ b.disabled = false; b.textContent = 'Connessione non riuscita: riprova'; });
    });
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  // pulsanti che portano alla sezione (hero e fondo pagina): scorrimento morbido e focus sul primo campo
  document.querySelectorAll('[data-wl-go]').forEach(function(a){
    a.addEventListener('click', function(e){
      var sec = document.getElementById('early-access'); if(!sec) return;
      e.preventDefault();
      var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      sec.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'});
      history.replaceState(null, '', '#early-access');
      setTimeout(function(){ emailEl.focus({preventScroll:true}); }, reduce ? 0 : 600);
    });
  });
})();
