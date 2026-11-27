using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Structure;
using Bina.Revit.Core;

namespace Bina.Revit
{
    public class Rapport
    {
        public List<string> Messages = new List<string>();
        public void Dire(string m) { Messages.Add(m); }
    }

    /* Lit le modèle et remplit le format d'échange. Règle : ce qui n'est pas lu dans le modèle n'est pas écrit.
       Conventions du format : un élément horizontal (dalle, poutre, semelle, pieu) est rattaché au niveau de sa face haute ;
       un élément vertical (poteau, voile) au niveau de sa face basse. Longueurs en m (Revit travaille en pieds). */
    public class Extracteur
    {
        readonly Document doc; readonly Rapport rap;
        const double ToleranceM = 0.02;
        public Extracteur(Document d, Rapport r) { doc = d; rap = r; }

        class Elt { public Ouvrage O; public double ZRef; public string Prefixe; public double X, Y; public string Bat; public string TypeNom; public string Niv; }

        static double M(double pieds) { return Unites.PiedsEnM(pieds); }

        public DocEchange Construire()
        {
            var ech = new DocEchange();
            ProjectInfo pi = doc.ProjectInformation;
            string nomProjet = Noms.Nettoyer(pi != null ? pi.Name : "");
            if (nomProjet.Length == 0) nomProjet = Noms.Nettoyer(doc.Title);
            ech.ProjetNom = nomProjet;
            string batDefaut = Noms.Nettoyer(pi != null ? pi.BuildingName : "");
            if (batDefaut.Length == 0) { batDefaut = nomProjet; rap.Dire("Le nom du bâtiment n'est pas renseigné dans Revit (Informations du projet) : le nom du projet est utilisé. Vous pouvez aussi remplir le paramètre texte Bina_Batiment sur les éléments."); }

            var niveaux = new FilteredElementCollector(doc).OfClass(typeof(Level)).Cast<Level>().OrderBy(l => l.Elevation).ToList();
            if (niveaux.Count == 0) { rap.Dire("Aucun niveau dans le modèle."); return ech; }
            var cotes = niveaux.Select(l => new CoteNiveau { Nom = Noms.Nettoyer(l.Name), CoteM = M(l.Elevation) }).ToList();

            var elts = new List<Elt>();
            Collecter(elts, cotes, batDefaut);

            var unique = new Noms.Unicite();
            var parBat = new Dictionary<string, Batiment>(StringComparer.Ordinal);
            foreach (var grp in elts.GroupBy(e => e.Bat))
            {
                var bat = new Batiment { Nom = grp.Key };
                var nomsNiveaux = new Noms.Unicite();
                for (int i = 0; i < cotes.Count; i++)
                {
                    var le = grp.Where(e => e.Niv == cotes[i].Nom).ToList();
                    if (le.Count == 0) continue;
                    var niv = new Niveau { Nom = nomsNiveaux.Rendre(cotes[i].Nom), CoteM = cotes[i].CoteM };
                    if (i + 1 < cotes.Count) niv.HauteurM = cotes[i + 1].CoteM - cotes[i].CoteM;
                    int n = 0; string prec = null;
                    foreach (var e in le.OrderBy(x => x.Prefixe).ThenBy(x => x.Y).ThenBy(x => x.X))
                    {
                        if (e.Prefixe != prec) { n = 0; prec = e.Prefixe; }
                        n++;
                        e.O.Nom = unique.Rendre(e.TypeNom ?? (e.Prefixe + n + " - " + cotes[i].Nom));
                        niv.Ouvrages.Add(e.O);
                    }
                    bat.Niveaux.Add(niv);
                }
                if (bat.Niveaux.Count > 0) ech.Batiments.Add(bat);
            }
            return ech;
        }

        void Collecter(List<Elt> sortie, List<CoteNiveau> cotes, string batDefaut)
        {
            Ajouter(sortie, cotes, batDefaut, BuiltInCategory.OST_Floors, "D", ElementEnDalle);
            Ajouter(sortie, cotes, batDefaut, BuiltInCategory.OST_StructuralFraming, "PX", ElementEnPoutre);
            Ajouter(sortie, cotes, batDefaut, BuiltInCategory.OST_StructuralColumns, "P", ElementEnPoteau);
            Ajouter(sortie, cotes, batDefaut, BuiltInCategory.OST_StructuralFoundation, "S", ElementEnFondation);
            Ajouter(sortie, cotes, batDefaut, BuiltInCategory.OST_Walls, "V", ElementEnVoile);
        }

        delegate bool Convertisseur(Element e, out Ouvrage o, out double zRef, out string prefixe);

        void Ajouter(List<Elt> sortie, List<CoteNiveau> cotes, string batDefaut, BuiltInCategory cat, string prefixeDefaut, Convertisseur conv)
        {
            foreach (Element e in new FilteredElementCollector(doc).OfCategory(cat).WhereElementIsNotElementType())
            {
                Ouvrage o; double z; string pre;
                try { if (!conv(e, out o, out z, out pre)) continue; }
                catch (Exception ex) { rap.Dire("Élément ignoré (" + Etiquette(e) + ") : " + ex.Message); continue; }
                o.IdExterne = e.UniqueId;
                LireCharges(e, o); LireMateriau(e, o);
                var niv = Niveaux.LePlusProche(cotes, z);
                if (Math.Abs(niv.CoteM - z) > ToleranceM) rap.Dire(Etiquette(e) + " : sa face de référence est à " + JsonEcriture.Nombre(Math.Abs(niv.CoteM - z)) + " m du niveau « " + niv.Nom + " » ; le format n'a pas de décalage, la maquette sera légèrement décalée.");
                string nomMarque = LireTexte(e, BuiltInParameter.ALL_MODEL_MARK);
                string typeSurcharge = LireTexteNomme(e, "Bina_Type");
                if (!string.IsNullOrEmpty(typeSurcharge)) { if (Array.IndexOf(Contrat.Types, typeSurcharge.Trim()) >= 0) o.Type = typeSurcharge.Trim(); else rap.Dire(Etiquette(e) + " : Bina_Type « " + typeSurcharge + " » inconnu, ignoré."); }
                var (cx, cy) = Centre(e);
                string bat = Noms.Nettoyer(LireTexteNomme(e, "Bina_Batiment")); if (bat.Length == 0) bat = batDefaut;
                sortie.Add(new Elt { O = o, ZRef = z, Prefixe = pre ?? prefixeDefaut, X = cx, Y = cy, Bat = bat, Niv = niv.Nom, TypeNom = string.IsNullOrWhiteSpace(nomMarque) ? null : Noms.Nettoyer(nomMarque) });
            }
        }

        static string Etiquette(Element e) { return e.Name + " [" + e.Id + "]"; }

        static (double, double) Centre(Element e)
        {
            BoundingBoxXYZ b = e.get_BoundingBox(null);
            return b == null ? (0.0, 0.0) : (M((b.Min.X + b.Max.X) / 2), M((b.Min.Y + b.Max.Y) / 2));
        }

        /* ---------- lecture de paramètres ---------- */
        static string LireTexte(Element e, BuiltInParameter p) { Parameter q = e.get_Parameter(p); return q != null && q.HasValue ? q.AsString() : null; }
        static string LireTexteNomme(Element e, string nom) { Parameter q = e.LookupParameter(nom); return q != null && q.HasValue && q.StorageType == StorageType.String ? q.AsString() : null; }

        /* Longueur (en m) lue sur l'instance puis sur le type, d'après une liste de noms possibles ; null si introuvable. */
        double? Longueur(Element e, params string[] noms)
        {
            Element type = doc.GetElement(e.GetTypeId());
            foreach (Element src in new[] { e, type })
            {
                if (src == null) continue;
                foreach (string n in noms)
                {
                    Parameter q = src.LookupParameter(n);
                    if (q != null && q.HasValue && q.StorageType == StorageType.Double && q.AsDouble() > 0) return M(q.AsDouble());
                }
            }
            return null;
        }

        /* Charges : paramètres de type Nombre nommés Bina_G_kN, Bina_Q_kN, Bina_g_kN_m2, Bina_q_kN_m2, Bina_g_kN_m, Bina_q_kN_m (valeur lue telle quelle, en kN). Absent = rien d'écrit. */
        void LireCharges(Element e, Ouvrage o)
        {
            foreach (string c in Contrat.ChargesAdmises)
            {
                Parameter q = e.LookupParameter("Bina_" + c);
                if (q == null || !q.HasValue || q.StorageType != StorageType.Double) continue;
                double v = q.AsDouble();
                if (v < 0) { rap.Dire(Etiquette(e) + " : charge Bina_" + c + " négative, ignorée."); continue; }
                o.Charge(c, v);
            }
        }

        void LireMateriau(Element e, Ouvrage o)
        {
            Parameter q = e.get_Parameter(BuiltInParameter.STRUCTURAL_MATERIAL_PARAM);
            if (q == null || !q.HasValue) return;
            Material m = doc.GetElement(q.AsElementId()) as Material;
            if (m == null) return;
            o.Beton = Materiaux.Beton(m.Name); o.Acier = Materiaux.Acier(m.Name);
        }

        /* ---------- convertisseurs par catégorie ---------- */
        bool ElementEnDalle(Element e, out Ouvrage o, out double zRef, out string pre)
        {
            o = null; zRef = 0; pre = "D";
            BoundingBoxXYZ b = e.get_BoundingBox(null); if (b == null) return false;
            double ep = e.get_Parameter(BuiltInParameter.FLOOR_ATTR_THICKNESS_PARAM) != null ? M(e.get_Parameter(BuiltInParameter.FLOOR_ATTR_THICKNESS_PARAM).AsDouble()) : M(b.Max.Z - b.Min.Z);
            if (ep <= 0) return false;
            double lx = M(b.Max.X - b.Min.X), ly = M(b.Max.Y - b.Min.Y);
            o = new Ouvrage { Type = "dalle" };
            o.Geo("x", M(b.Min.X)).Geo("y", M(b.Min.Y)).Geo("largeur_m", lx).Geo("longueur_m", ly).Geo("epaisseur_m", ep);
            zRef = M(b.Max.Z);
            try
            {
                var tops = HostObjectUtils.GetTopFaces((HostObject)e);
                if (tops.Count == 1)
                {
                    PlanarFace f = e.GetGeometryObjectFromReference(tops[0]) as PlanarFace;
                    if (f != null && M(M(f.Area)) < 0.97 * lx * ly) rap.Dire(Etiquette(e) + " : dalle non rectangulaire. Le format v1 ne contient que des rectangles : l'emprise rectangulaire englobante est écrite (surface surestimée).");
                }
            }
            catch (Exception) { }
            return true;
        }

        bool ElementEnPoutre(Element e, out Ouvrage o, out double zRef, out string pre)
        {
            o = null; zRef = 0; pre = "PX";
            var fi = e as FamilyInstance; if (fi == null || fi.StructuralType != StructuralType.Beam) return false;
            var lc = fi.Location as LocationCurve; if (lc == null) return false;
            var ligne = lc.Curve as Line; if (ligne == null) { rap.Dire(Etiquette(e) + " : poutre courbe, non exportée (le format v1 ne contient que des poutres droites)."); return false; }
            BoundingBoxXYZ bb = e.get_BoundingBox(null); if (bb == null) return false;
            double? h = Longueur(e, "h", "H", "Hauteur", "Height", "d");
            double? b = Longueur(e, "b", "B", "Largeur", "Width", "bf");
            if (h == null) h = M(bb.Max.Z - bb.Min.Z);
            if (b == null)
            {
                XYZ dir = (ligne.GetEndPoint(1) - ligne.GetEndPoint(0)).Normalize();
                if (Math.Abs(dir.X) < 1e-6) b = M(bb.Max.X - bb.Min.X); else if (Math.Abs(dir.Y) < 1e-6) b = M(bb.Max.Y - bb.Min.Y);
            }
            if (b == null || h <= 0) { rap.Dire(Etiquette(e) + " : section de poutre illisible (paramètres b et h introuvables), non exportée."); return false; }
            XYZ p0 = ligne.GetEndPoint(0), p1 = ligne.GetEndPoint(1);
            o = new Ouvrage { Type = "poutre" };
            o.Geo("x1", M(p0.X)).Geo("y1", M(p0.Y)).Geo("x2", M(p1.X)).Geo("y2", M(p1.Y)).Geo("b_m", b.Value).Geo("h_m", h.Value);
            zRef = M(bb.Max.Z);
            return true;
        }

        bool ElementEnPoteau(Element e, out Ouvrage o, out double zRef, out string pre)
        {
            o = null; zRef = 0; pre = "P";
            var fi = e as FamilyInstance; if (fi == null) return false;
            BoundingBoxXYZ bb = e.get_BoundingBox(null); if (bb == null) return false;
            double dx = M(bb.Max.X - bb.Min.X), dy = M(bb.Max.Y - bb.Min.Y), hauteur = M(bb.Max.Z - bb.Min.Z);
            if (hauteur <= 0) return false;
            var lp = fi.Location as LocationPoint;
            if (lp != null)
            {
                double rot = Math.Abs(lp.Rotation) % (Math.PI / 2);
                if (rot > 0.02 && Math.PI / 2 - rot > 0.02) rap.Dire(Etiquette(e) + " : poteau tourné d'un angle quelconque. Le format v1 n'a pas de rotation : la section écrite est celle de l'emprise englobante.");
            }
            string nomType = (fi.Symbol != null ? fi.Symbol.Name + " " + fi.Symbol.FamilyName : "").ToLowerInvariant();
            bool rond = (nomType.Contains("rond") || nomType.Contains("circ") || nomType.Contains("round")) && Math.Abs(dx - dy) < 0.001;
            o = new Ouvrage { Type = "poteau" };
            o.Geo("x", M((bb.Min.X + bb.Max.X) / 2)).Geo("y", M((bb.Min.Y + bb.Max.Y) / 2));
            if (rond) o.Geo("diametre_m", dx); else o.Geo("b_m", dx).Geo("h_m", dy);
            o.Geo("hauteur_m", hauteur);
            zRef = M(bb.Min.Z);
            return true;
        }

        bool ElementEnFondation(Element e, out Ouvrage o, out double zRef, out string pre)
        {
            o = null; zRef = 0; pre = "S";
            var fi = e as FamilyInstance;
            if (fi == null) { rap.Dire(Etiquette(e) + " : fondation filante ou radier, non exportée (hors du format v1)."); return false; }
            BoundingBoxXYZ bb = e.get_BoundingBox(null); if (bb == null) return false;
            double dx = M(bb.Max.X - bb.Min.X), dy = M(bb.Max.Y - bb.Min.Y), dz = M(bb.Max.Z - bb.Min.Z);
            string nom = (fi.Symbol != null ? fi.Symbol.Name + " " + fi.Symbol.FamilyName : "").ToLowerInvariant();
            double cx = M((bb.Min.X + bb.Max.X) / 2), cy = M((bb.Min.Y + bb.Max.Y) / 2);
            if (nom.Contains("pieu") || nom.Contains("pile"))
            {
                o = new Ouvrage { Type = "pieu" }; pre = "PI";
                o.Geo("x", cx).Geo("y", cy).Geo("diametre_m", Math.Max(dx, dy)).Geo("longueur_m", dz);
            }
            else
            {
                o = new Ouvrage { Type = "semelle" };
                o.Geo("x", cx).Geo("y", cy).Geo("largeur_m", dx).Geo("longueur_m", dy).Geo("epaisseur_m", dz);
            }
            zRef = M(bb.Max.Z);
            return true;
        }

        bool ElementEnVoile(Element e, out Ouvrage o, out double zRef, out string pre)
        {
            o = null; zRef = 0; pre = "V";
            var w = e as Wall; if (w == null || w.StructuralUsage == StructuralWallUsage.NonBearing) return false;
            var lc = w.Location as LocationCurve; var ligne = lc != null ? lc.Curve as Line : null;
            if (ligne == null) { rap.Dire(Etiquette(e) + " : mur porteur courbe, non exporté (le format v1 ne contient que des murs droits)."); return false; }
            BoundingBoxXYZ bb = e.get_BoundingBox(null); if (bb == null) return false;
            XYZ p0 = ligne.GetEndPoint(0), p1 = ligne.GetEndPoint(1);
            o = new Ouvrage { Type = "voile" };
            o.Geo("x1", M(p0.X)).Geo("y1", M(p0.Y)).Geo("x2", M(p1.X)).Geo("y2", M(p1.Y)).Geo("epaisseur_m", M(w.Width)).Geo("hauteur_m", M(bb.Max.Z - bb.Min.Z));
            zRef = M(bb.Min.Z);
            return true;
        }
    }
}
