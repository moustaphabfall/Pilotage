using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Bina.Revit.Core;

namespace Bina.Revit
{
    /* Lecture seule : le plugin ne modifie jamais le modèle. */
    [Transaction(TransactionMode.ReadOnly)]
    public class ExportCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData data, ref string message, ElementSet elements)
        {
            try
            {
                Document doc = data.Application.ActiveUIDocument.Document;
                var rapport = new Rapport();
                DocEchange ech = new Extracteur(doc, rapport).Construire();
                ech.VersionOutil = data.Application.Application.VersionNumber;
                ech.VersionPlugin = typeof(ExportCommand).Assembly.GetName().Version.ToString(3);
                ech.DateExport = DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");

                var erreurs = Controle.Verifier(ech);
                if (erreurs.Count > 0)
                {
                    TaskDialog.Show("Bina", "Aucun fichier écrit : le modèle ne donne pas un fichier valide.\n\n" + string.Join("\n", erreurs.Take(15)) + RapportTexte(rapport));
                    return Result.Cancelled;
                }

                string defaut = Noms.Nettoyer(ech.ProjetNom);
                foreach (char c in Path.GetInvalidFileNameChars()) defaut = defaut.Replace(c, '_');
                using (var dlg = new SaveFileDialog { Filter = "Fichier d'échange Bina (*.json)|*.json", FileName = (defaut.Length > 0 ? defaut : "projet") + "-bina.json", Title = "Exporter vers Bina" })
                {
                    if (dlg.ShowDialog() != DialogResult.OK) return Result.Cancelled;
                    File.WriteAllText(dlg.FileName, JsonEcriture.Ecrire(ech), new UTF8Encoding(false));
                    int n = ech.Batiments.Sum(b => b.Niveaux.Sum(x => x.Ouvrages.Count));
                    TaskDialog.Show("Bina", "Fichier écrit : " + dlg.FileName + "\n" + n + " ouvrage(s).\nImportez-le dans l'application : Descente de charge > Depuis un plugin > Choisir un fichier." + RapportTexte(rapport));
                }
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                TaskDialog.Show("Bina", "L'export a échoué. Rien n'a été modifié dans le modèle.\n\n" + ex.Message);
                return Result.Failed;
            }
        }

        static string RapportTexte(Rapport r)
        {
            if (r.Messages.Count == 0) return "";
            var sb = new StringBuilder("\n\nÀ savoir (" + r.Messages.Count + ") :\n");
            foreach (var m in r.Messages.Take(15)) sb.Append("- ").Append(m).Append('\n');
            if (r.Messages.Count > 15) sb.Append("- … et ").Append(r.Messages.Count - 15).Append(" autres.\n");
            return sb.ToString();
        }
    }
}
