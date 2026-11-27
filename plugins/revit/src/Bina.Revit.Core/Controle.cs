using System;
using System.Collections.Generic;

namespace Bina.Revit.Core
{
    /* Contrôle minimal avant écriture : mêmes exigences que l'application, pour ne pas écrire un fichier qu'elle refuserait. */
    public static class Controle
    {
        static readonly Dictionary<string, string[]> Requis = new Dictionary<string, string[]>
        {
            { "dalle", new[] { "x", "y", "largeur_m", "longueur_m", "epaisseur_m" } },
            { "poutre", new[] { "x1", "y1", "x2", "y2", "b_m", "h_m" } },
            { "poteau", new[] { "x", "y", "hauteur_m" } },
            { "voile", new[] { "x1", "y1", "x2", "y2", "epaisseur_m", "hauteur_m" } },
            { "semelle", new[] { "x", "y", "largeur_m", "longueur_m", "epaisseur_m" } },
            { "pieu", new[] { "x", "y", "diametre_m", "longueur_m" } },
            { "mur_soutenement", new[] { "x1", "y1", "x2", "y2", "epaisseur_m", "hauteur_m" } },
            { "escalier", new[] { "x1", "y1", "x2", "y2", "largeur_m", "hauteur_m" } }
        };

        public static List<string> Verifier(DocEchange d)
        {
            var e = new List<string>();
            if (string.IsNullOrWhiteSpace(d.ProjetNom)) e.Add("Le nom du projet est vide.");
            if (d.Batiments.Count == 0) e.Add("Aucun bâtiment.");
            var noms = new HashSet<string>(); var ids = new HashSet<string>(); int total = 0;
            foreach (var b in d.Batiments)
            {
                var nn = new HashSet<string>();
                foreach (var n in b.Niveaux)
                {
                    if (!nn.Add(Noms.Cle(n.Nom))) e.Add("Niveau en double dans « " + b.Nom + " » : " + n.Nom);
                    foreach (var o in n.Ouvrages)
                    {
                        total++;
                        string ctx = "Ouvrage « " + o.Nom + " » : ";
                        if (!noms.Add(Noms.Cle(o.Nom))) e.Add(ctx + "nom déjà utilisé.");
                        if (!string.IsNullOrEmpty(o.IdExterne) && !ids.Add(o.IdExterne)) e.Add(ctx + "identifiant d'origine en double.");
                        string[] req;
                        if (!Requis.TryGetValue(o.Type ?? "", out req)) { e.Add(ctx + "type inconnu."); continue; }
                        var g = new Dictionary<string, double>(); foreach (var kv in o.Geometrie) g[kv.Key] = kv.Value;
                        foreach (var k in req) if (!g.ContainsKey(k)) e.Add(ctx + "champ « " + k + " » absent.");
                        foreach (var kv in g) { if (double.IsNaN(kv.Value) || double.IsInfinity(kv.Value)) e.Add(ctx + kv.Key + " n'est pas un nombre."); else if (kv.Key.EndsWith("_m") && kv.Value <= 0) e.Add(ctx + kv.Key + " doit être supérieur à 0."); }
                        if (o.Type == "poteau" && !(g.ContainsKey("diametre_m") ^ (g.ContainsKey("b_m") && g.ContainsKey("h_m")))) e.Add(ctx + "poteau : section (b_m et h_m) ou diametre_m, pas les deux ni aucun.");
                        foreach (var kv in o.Charges) if (Array.IndexOf(Contrat.ChargesAdmises, kv.Key) < 0 || kv.Value < 0) e.Add(ctx + "charge « " + kv.Key + " » invalide.");
                    }
                }
            }
            if (total == 0) e.Add("Aucun ouvrage à exporter.");
            return e;
        }
    }
}
