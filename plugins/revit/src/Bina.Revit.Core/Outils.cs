using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Bina.Revit.Core
{
    public static class Unites
    {
        public const double PiedEnMetre = 0.3048; /* Revit stocke les longueurs en pieds */
        public static double PiedsEnM(double pieds) { return pieds * PiedEnMetre; }
    }

    /* Matériau : on ne garde que ce qui se lit dans le nom du matériau du modèle. Rien lu = champ absent. */
    public static class Materiaux
    {
        static readonly Regex RxBeton = new Regex("\\bC\\s?(\\d{2})\\s?/\\s?(\\d{2})\\b", RegexOptions.IgnoreCase);
        static readonly Regex RxAcier = new Regex("\\b(B\\s?500\\s?[ABC]?|HA\\s?\\d{3})\\b", RegexOptions.IgnoreCase);

        public static string Beton(string nomMateriau)
        {
            if (string.IsNullOrWhiteSpace(nomMateriau)) return null;
            var m = RxBeton.Match(nomMateriau);
            return m.Success ? "C" + m.Groups[1].Value + "/" + m.Groups[2].Value : null;
        }

        public static string Acier(string nomMateriau)
        {
            if (string.IsNullOrWhiteSpace(nomMateriau)) return null;
            var m = RxAcier.Match(nomMateriau);
            return m.Success ? m.Groups[1].Value.Replace(" ", "").ToUpperInvariant() : null;
        }
    }

    public class CoteNiveau { public string Nom; public double CoteM; }

    public static class Niveaux
    {
        /* Niveau dont la cote est la plus proche de z ; null s'il n'y a aucun niveau. */
        public static CoteNiveau LePlusProche(IList<CoteNiveau> niveaux, double zM)
        {
            CoteNiveau best = null; double ecart = double.MaxValue;
            foreach (var n in niveaux)
            {
                double e = Math.Abs(n.CoteM - zM);
                if (e < ecart) { ecart = e; best = n; }
            }
            return best;
        }
    }
}
