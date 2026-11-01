/* À renseigner : Supabase → Project Settings → API (URL du projet + clé « anon / publishable »). La clé anon est publique par conception ; l'accès est protégé par les règles RLS de supabase/schema.sql. */
window.PILOTAGE_CONFIG = {
  url: 'https://mejwjoyumcuxvaqfooxq.supabase.co',      // ex. https://xxxxxxxx.supabase.co
  anonKey: 'sb_publishable_vj5RIBOrB4SgMGf00bOmyg_B4rvR4aZ'   // ex. eyJhbGciOi... ou sb_publishable_...
};
/* Hébergements proposés : chaque fournisseur est actif s'il est configuré. backend:'supabase'|'sharepoint' force un choix ; sans backend, l'application propose la liste.
   Microsoft 365 / SharePoint : enregistrer UNE FOIS l'application chez Microsoft (Entra ID → Inscriptions d'applications → « Application monopage », URI de redirection = l'adresse de l'application), puis coller l'ID de l'application ici. */
window.PILOTAGE_CONFIG.msClientId = '8c2f5e1a-445b-41dd-800c-60957f3d4add';      // ex. 00000000-0000-0000-0000-000000000000
// window.PILOTAGE_CONFIG.backend = 'supabase';
