/* Intro del logo prima della landing: la stessa animazione dell'app (INTRO_ANIM, copiata dalla build da
   js/data/intro-anim.js). Copre la pagina finché non finisce, poi sfuma; window.INTRO_DONE si risolve in quel momento
   così le animazioni della pagina partono dopo. Senza Lottie o senza dati la pagina si mostra subito. */
(function(){
  var box = document.getElementById('intro'), done;
  window.INTRO_DONE = new Promise(function(r){ done = r; });
  if(!box || !window.lottie || typeof INTRO_ANIM === 'undefined'){ if(box) box.remove(); done(); return; }
  var html = document.documentElement, closed = false;
  html.style.overflow = 'hidden';
  function close(){
    if(closed) return; closed = true;
    box.style.opacity = '0'; box.style.pointerEvents = 'none';
    html.style.overflow = '';
    done();
    setTimeout(function(){ box.remove(); }, 400);
  }
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anim = lottie.loadAnimation({container: document.getElementById('intro-anim'), renderer:'svg', loop:false, autoplay:!reduced, animationData: INTRO_ANIM});
  // con «riduci movimento» il logo completo (fotogramma 62), non il nero finale
  if(reduced){ anim.addEventListener('DOMLoaded', function(){ anim.goToAndStop(62, true); }); setTimeout(close, 900); return; }
  anim.addEventListener('complete', close);   // finisce sul nero, poi la pagina
  setTimeout(close, 7000);
})();
