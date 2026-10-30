# Application « Pilotage » (installable, avec comptes)

État : base Supabase prête (schéma exécuté), fonction `admin-users` déployée, premier compte administrateur créé.

1. **Héberger** le dossier `pwa/` sur un hébergeur statique HTTPS (Netlify Drop, Cloudflare Pages, Vercel…). Aucune donnée du chantier n'est dans les fichiers : tout vient de Supabase après connexion.
2. **Se connecter** avec le compte administrateur. Menu **🗂 Données → 🔑 Gérer les accès** : créer un compte (nom, e-mail, mot de passe généré, rôle), changer le rôle, retirer l'accès, nouveau mot de passe, supprimer. Le texte « lien + identifiant + mot de passe » est prêt à copier.
3. **Charger les données** : dans l'artefact, 🗂 Données → Exporter ; dans l'application, 🗂 Données → Charger une sauvegarde.
4. **Installer** : Android/Chrome « Installer l'application » ; iPhone/Safari Partager → « Sur l'écran d'accueil ».
5. Après chaque évolution de l'artefact : `python3 build_pwa.py` puis redéployer.

Rôles : administrateur (tout + accès), éditeur (saisit), lecteur (consulte).

## Administration et hébergement des données (deux choses séparées)
- **Administration** (comptes, projets, rôles, fonctionnalités, paiement mensuel) : toujours dans l'annuaire de l'outil (Supabase), quel que soit l'hébergement. Page « Projet ».
- **Hébergement des données** de chaque projet : rubrique « Hébergement des données » de la page Projet. Par défaut la base de l'outil ; sinon un fournisseur (fichier `*-adapter.js` enregistré dans `window.PILOTAGE_PROVIDERS` avec `{label, available(), setup(), open()}`). Le client (administrateur du projet) autorise avec son compte, ou l'administrateur de l'outil le fait à sa place. Les données existantes sont copiées vers le nouvel hébergement et les membres y sont invités (lecture / écriture) automatiquement.
- **Microsoft 365 / SharePoint** : actif si `msClientId` est renseigné dans `config.js`. Inscription unique : Entra ID → Inscriptions d'applications → Nouvelle → « Application monopage (SPA) », URI de redirection = adresse de l'application ; autorisations Microsoft Graph déléguées User.Read, Files.ReadWrite.All, Sites.ReadWrite.All (consentement d'un administrateur du tenant).
