# Plugin Revit « Exporter vers Bina »

Ce plugin ajoute dans Revit un onglet **Bina** avec un bouton **Exporter vers Bina**. Il écrit un fichier `.json` du modèle. Vous importez ensuite ce fichier dans l'application (Descente de charge > Depuis un plugin > Choisir un fichier).

Le plugin **lit** le modèle, il ne le modifie jamais. Le format du fichier est décrit dans `docs/plugin-echange.md` (version 1.0).

> État : le code est écrit mais **n'a pas encore été compilé ni essayé dans Revit**. Premier essai à faire par vous. Si la compilation signale une erreur, envoyez le message : la correction est en général d'une ligne.

## Ce qui est exporté

| Dans Revit | Dans le fichier |
|---|---|
| Informations du projet (nom) | projet |
| Nom du bâtiment (Informations du projet) ou paramètre texte `Bina_Batiment` sur l'élément | bâtiment |
| Niveaux | niveaux (cote, hauteur jusqu'au niveau suivant) |
| Planchers | dalle (emprise rectangulaire englobante) |
| Poutres droites | poutre |
| Poteaux structurels | poteau (section rectangulaire, ou ronde si le nom de la famille contient rond, circ ou round) |
| Fondations isolées | semelle (pieu si le nom contient pieu ou pile) |
| Murs porteurs droits | voile |

Pour forcer le type d'un élément (par exemple mur de soutènement), créez un paramètre texte `Bina_Type` et écrivez le type voulu : `dalle`, `poutre`, `poteau`, `voile`, `semelle`, `pieu`, `mur_soutenement`, `escalier`.

**Charges** : seulement si vous les avez saisies. Créez des paramètres de type *Nombre* nommés `Bina_G_kN`, `Bina_Q_kN`, `Bina_g_kN_m2`, `Bina_q_kN_m2`, `Bina_g_kN_m`, `Bina_q_kN_m` et remplissez-les en kN. Un paramètre vide n'écrit rien.

**Matériau** : lu dans le nom du matériau structurel (par exemple « Béton C25/30 »). Rien de reconnu, rien d'écrit.

**Jamais écrit** : sol, efforts calculés, valeurs par défaut. Ce qui n'est pas dans le modèle reste absent.

**Noms** : repère (Mark) si rempli, sinon un nom comme « P3 - RDC ». Les noms sont rendus uniques dans tout le projet (le deuxième « P1 » devient « P1 (2) »).

À la fin, une fenêtre liste ce qui n'a pas pu être exporté ou est approché (poutres courbes, dalles non rectangulaires, fondations filantes, petits décalages de niveau).

## Installer pas à pas

Il faut Windows, Revit 2022 ou plus récent, et le « SDK .NET 8 » (gratuit, dotnet.microsoft.com).

1. Ouvrez une fenêtre PowerShell dans le dossier `plugins/revit`.
2. Compilez pour votre version de Revit (exemple 2025) :
   `dotnet build src/Bina.Revit.Addin -c Release -p:RevitVersion=2025`
   Les fichiers de l'API Revit sont téléchargés automatiquement depuis NuGet. Si vous préférez ceux de votre Revit :
   `dotnet build src/Bina.Revit.Addin -c Release -p:RevitVersion=2025 -p:RevitInstallDir="C:\Program Files\Autodesk\Revit 2025"`
   Revit 2022 à 2024 : .NET Framework 4.8 (dossier `net48`). Revit 2025 et plus : dossier `net8.0-windows`.
3. Installez :
   `.\installation\install.ps1 -Revit 2025 -Dossier src\Bina.Revit.Addin\bin\Release\net8.0-windows`
   (pour 2022 à 2024 : `...\Release\net48`).
4. Fermez Revit s'il était ouvert, puis rouvrez-le. Si Revit demande s'il faut charger le plugin, répondez « Toujours charger ».
5. Ouvrez votre maquette. Onglet **Bina**, bouton **Exporter vers Bina**. Choisissez où écrire le fichier.
6. Dans l'application : Descente de charge > Depuis un plugin > Choisir un fichier. Contrôlez le découpage et la maquette 3D, puis « Créer en bibliothèque ».

Pour désinstaller : supprimez `Bina.addin` et le dossier `Bina` dans `%AppData%\Autodesk\Revit\Addins\<version>`.

## Tests (sans Revit)

`dotnet test tests/Bina.Revit.Core.Tests`

Ils vérifient l'écriture du fichier (point décimal, champs absents, noms uniques, contrôle) et que le fichier `exemple/exemple-revit.json` est identique à ce que le plugin écrit. Ce même fichier est contrôlé par les tests de l'application (`node tests/descente.test.js`).

## Limites connues du format version 1

- Pas de rotation pour dalles, semelles et poteaux : la section est celle de l'emprise englobante.
- Pas de contour libre pour les dalles (rectangles seulement).
- Pas de décalage vertical : un élément est posé sur la cote du niveau le plus proche.
- Pas de semelle filante ni de radier.
- Pas d'escalier exporté automatiquement (type possible via `Bina_Type`).

## Dossiers

- `src/Bina.Revit.Core` : écriture du fichier, noms, contrôle. Aucune dépendance Revit.
- `src/Bina.Revit.Addin` : bouton du ruban, lecture du modèle Revit.
- `tests/Bina.Revit.Core.Tests` : tests.
- `exemple/exemple-revit.json` : fichier d'exemple conforme.
- `installation` : manifeste et script d'installation.
