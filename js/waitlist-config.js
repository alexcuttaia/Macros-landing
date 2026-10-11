/* Lista d'attesa: indirizzo della Edge Function «waitlist» sul progetto Supabase di MACRO'S (lo stesso dell'app).
   La chiave è quella pubblica (anon/publishable), come in js/core/cloud.js dell'app: non dà accesso alle tabelle,
   che sono chiuse da RLS. Lasciare endpoint vuoto disattiva l'invio (il modulo lo dice). */
window.WAITLIST_CONFIG = {
  endpoint: 'https://tbpqipapinadflefhkvu.supabase.co/functions/v1/waitlist',
  anonKey: 'sb_publishable_Pi2YYDHW_9AZrqyYD-VWhg_dOzh3hMK',
};
