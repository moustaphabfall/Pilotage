using System;
using System.Reflection;
using Autodesk.Revit.UI;

namespace Bina.Revit
{
    /* Crée l'onglet « Bina » avec le bouton « Exporter vers Bina » dans le ruban de Revit. */
    public class App : IExternalApplication
    {
        public Result OnStartup(UIControlledApplication app)
        {
            try
            {
                const string onglet = "Bina";
                try { app.CreateRibbonTab(onglet); } catch (Exception) { /* l'onglet existe déjà */ }
                RibbonPanel panneau = app.CreateRibbonPanel(onglet, "Descente de charge");
                var bouton = new PushButtonData("BinaExporter", "Exporter vers Bina", Assembly.GetExecutingAssembly().Location, "Bina.Revit.ExportCommand");
                bouton.ToolTip = "Écrit un fichier JSON du modèle (niveaux, dalles, poutres, poteaux, semelles, voiles) à importer dans l'application Bina.";
                panneau.AddItem(bouton);
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Bina", "Le plugin n'a pas pu créer son bouton : " + ex.Message);
                return Result.Failed;
            }
        }

        public Result OnShutdown(UIControlledApplication app) { return Result.Succeeded; }
    }
}
