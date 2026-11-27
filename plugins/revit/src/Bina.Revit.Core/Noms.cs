using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Bina.Revit.Core
{
    /* Même règle de comparaison que l'application : sans casse, sans accents, espaces réduits. */
    public static class Noms
    {
        public static string Nettoyer(string s)
        {
            if (s == null) return "";
            var sb = new StringBuilder();
            foreach (char c in s) sb.Append(char.IsControl(c) ? ' ' : c);
            string t = Regex.Replace(sb.ToString(), "\\s+", " ").Trim();
            return t.Length > 120 ? t.Substring(0, 120).Trim() : t;
        }

        public static string Cle(string s)
        {
            string t = Nettoyer(s).ToLowerInvariant().Replace("œ", "oe").Replace("æ", "ae").Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();
            foreach (char c in t) if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
            return sb.ToString();
        }

        /* Rend les noms uniques dans tout le projet : le 2e « P1 » devient « P1 (2) », etc. */
        public class Unicite
        {
            readonly HashSet<string> vus = new HashSet<string>();
            public string Rendre(string nom)
            {
                string base0 = Nettoyer(nom);
                if (base0.Length == 0) base0 = "Sans nom";
                string cand = base0; int i = 2;
                while (vus.Contains(Cle(cand)))
                {
                    string suf = " (" + i + ")"; i++;
                    cand = (base0.Length + suf.Length > 120 ? base0.Substring(0, 120 - suf.Length) : base0) + suf;
                }
                vus.Add(Cle(cand));
                return cand;
            }
        }
    }
}
