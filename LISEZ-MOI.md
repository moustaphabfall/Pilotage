# Application « Pilotage » (installable, avec comptes)

État : base Supabase prête (schéma exécuté), fonction `admin-users` déployée, premier compte administrateur créé.

1. **Héberger** le dossier `pwa/` sur un hébergeur statique HTTPS (Netlify Drop, Cloudflare Pages, Vercel…). Aucune donnée du chantier n'est dans les fichiers : tout vient de Supabase après connexion.
2. **Se connecter** avec le compte administrateur. Menu **🗂 Données → 🔑 Gérer les accès** : créer un compte (nom, e-mail, mot de passe généré, rôle), changer le rôle, retirer l'accès, nouveau mot de passe, supprimer. Le texte « lien + identifiant + mot de passe » est prêt à copier.
3. **Charger les données** : dans l'artefact, 🗂 Données → Exporter ; dans l'application, 🗂 Données → Charger une sauvegarde.
4. **Installer** : Android/Chrome « Installer l'application » ; iPhone/Safari Partager → « Sur l'écran d'accueil ».
5. Après chaque évolution de l'artefact : `python3 build_pwa.py` puis redéployer.

Rôles : administrateur (tout + accès), éditeur (saisit), lecteur (consulte).

## Hébergements (fournisseurs)
`pilotage-core.js` choisit l'hébergement ; chaque fournisseur est un fichier `*-adapter.js` qui s'enregistre dans `window.PILOTAGE_PROVIDERS`.
- **Supabase** : actif si `url` et `anonKey` sont dans `config.js` (gestion des accès, rôles, fonctionnalités, paiement mensuel dans la page « Projet »).
- **Microsoft 365 / SharePoint** : actif si `msClientId` est renseigné. Un projet = un dossier `Pilotage/<projet>` d'un site SharePoint ; ses membres partagent ce dossier (droits lecture / écriture donnés par l'administrateur du projet dans la page « Projet »).
  Mise en place unique : Entra ID → Inscriptions d'applications → Nouvelle → « Application monopage (SPA) », URI de redirection = adresse de l'application ; autorisations Microsoft Graph déléguées : User.Read, Files.ReadWrite.All, Sites.ReadWrite.All (consentement d'un administrateur du tenant) ; coller l'ID dans `config.js`.
- Autres fournisseurs : ajouter un fichier qui expose `{label, available(), init()}` et définit `PILOTAGE_SB`, `PILOTAGE_BLOBS`, `PILOTAGE_USER`, `PILOTAGE_PROJET`.
