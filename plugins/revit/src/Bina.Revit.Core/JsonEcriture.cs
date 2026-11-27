using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Bina.Revit.Core
{
    /* Écrit le JSON à la main : pas de bibliothèque à livrer à côté du plugin (évite les conflits avec Revit). Culture invariante : point décimal toujours. */
    public static class JsonEcriture
    {
        public static string Nombre(double v)
        {
            if (double.IsNaN(v) || double.IsInfinity(v)) throw new ArgumentException("Nombre non fini");
            double r = Math.Round(v, 4);
            if (r == 0) r = 0; /* évite « -0 » */
            return r.ToString("0.####", CultureInfo.InvariantCulture);
        }

        public static string Texte(string s)
        {
            var sb = new StringBuilder("\"");
            foreach (char c in s ?? "")
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.Append('"').ToString();
        }

        static string Objet(IEnumerable<KeyValuePair<string, double>> champs)
        {
            var p = new List<string>();
            foreach (var kv in champs) p.Add(Texte(kv.Key) + ":" + Nombre(kv.Value));
            return "{" + string.Join(",", p) + "}";
        }

        public static string Ecrire(DocEchange d)
        {
            var sb = new StringBuilder();
            sb.Append("{\n");
            sb.Append("\"format\":").Append(Texte(Contrat.Format)).Append(",\n");
            sb.Append("\"version\":").Append(Texte(Contrat.Version)).Append(",\n");
            var src = new List<string> { "\"outil\":" + Texte(d.Outil ?? "Revit") };
            if (!string.IsNullOrWhiteSpace(d.VersionOutil)) src.Add("\"version_outil\":" + Texte(d.VersionOutil));
            if (!string.IsNullOrWhiteSpace(d.VersionPlugin)) src.Add("\"version_plugin\":" + Texte(d.VersionPlugin));
            sb.Append("\"source\":{").Append(string.Join(",", src)).Append("},\n");
            if (!string.IsNullOrWhiteSpace(d.DateExport)) sb.Append("\"date_export\":").Append(Texte(d.DateExport)).Append(",\n");
            sb.Append("\"projet\":{\"nom\":").Append(Texte(d.ProjetNom)).Append("},\n");
            sb.Append("\"batiments\":[\n");
            for (int i = 0; i < d.Batiments.Count; i++)
            {
                var b = d.Batiments[i];
                sb.Append("{\"nom\":").Append(Texte(b.Nom)).Append(",\"niveaux\":[\n");
                for (int j = 0; j < b.Niveaux.Count; j++)
                {
                    var n = b.Niveaux[j];
                    sb.Append("{\"nom\":").Append(Texte(n.Nom)).Append(",\"cote_m\":").Append(Nombre(n.CoteM));
                    if (n.HauteurM.HasValue) sb.Append(",\"hauteur_m\":").Append(Nombre(n.HauteurM.Value));
                    sb.Append(",\"ouvrages\":[\n");
                    for (int k = 0; k < n.Ouvrages.Count; k++)
                    {
                        var o = n.Ouvrages[k];
                        sb.Append("{\"nom\":").Append(Texte(o.Nom)).Append(",\"type\":").Append(Texte(o.Type));
                        if (!string.IsNullOrWhiteSpace(o.IdExterne)) sb.Append(",\"id_externe\":").Append(Texte(o.IdExterne));
                        sb.Append(",\"geometrie\":").Append(Objet(o.Geometrie));
                        if (o.Charges.Count > 0) sb.Append(",\"charges\":").Append(Objet(o.Charges));
                        var mat = new List<string>();
                        if (!string.IsNullOrWhiteSpace(o.Beton)) mat.Add("\"beton\":" + Texte(o.Beton));
                        if (!string.IsNullOrWhiteSpace(o.Acier)) mat.Add("\"acier\":" + Texte(o.Acier));
                        if (mat.Count > 0) sb.Append(",\"materiau\":{").Append(string.Join(",", mat)).Append("}");
                        sb.Append("}").Append(k < n.Ouvrages.Count - 1 ? ",\n" : "\n");
                    }
                    sb.Append("]}").Append(j < b.Niveaux.Count - 1 ? ",\n" : "\n");
                }
                sb.Append("]}").Append(i < d.Batiments.Count - 1 ? ",\n" : "\n");
            }
            sb.Append("]\n}\n");
            return sb.ToString();
        }
    }
}
