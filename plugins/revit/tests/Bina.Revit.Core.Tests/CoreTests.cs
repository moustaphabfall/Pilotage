using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using Bina.Revit.Core;
using Xunit;

namespace Bina.Revit.Core.Tests
{
    public class CoreTests
    {
        /* Même document que exemple/exemple-revit.json. */
        public static DocEchange Exemple()
        {
            var d = new DocEchange { VersionOutil = "2025", VersionPlugin = "0.1.0", DateExport = "2026-11-27T10:00:00Z", ProjetNom = "Exemple Revit" };
            var b = new Batiment { Nom = "Bâtiment A" }; d.Batiments.Add(b);
            var f = new Niveau { Nom = "Fondations", CoteM = -1.2, HauteurM = 1.2 }; b.Niveaux.Add(f);
            f.Ouvrages.Add(new Ouvrage { Nom = "S1 - Fondations", Type = "semelle", IdExterne = "exemple-0001" }.Geo("x", 0).Geo("y", 0).Geo("largeur_m", 1.2).Geo("longueur_m", 1.2).Geo("epaisseur_m", 0.4));
            f.Ouvrages.Add(new Ouvrage { Nom = "S2 - Fondations", Type = "semelle", IdExterne = "exemple-0002" }.Geo("x", 5).Geo("y", 0).Geo("largeur_m", 1.2).Geo("longueur_m", 1.2).Geo("epaisseur_m", 0.4));
            var r = new Niveau { Nom = "RDC", CoteM = 0, HauteurM = 3 }; b.Niveaux.Add(r);
            r.Ouvrages.Add(new Ouvrage { Nom = "P1", Type = "poteau", IdExterne = "exemple-0003", Beton = "C25/30", Acier = "B500" }.Geo("x", 0).Geo("y", 0).Geo("b_m", 0.3).Geo("h_m", 0.3).Geo("hauteur_m", 3).Charge("G_kN", 210.5).Charge("Q_kN", 55));
            r.Ouvrages.Add(new Ouvrage { Nom = "P2", Type = "poteau", IdExterne = "exemple-0004" }.Geo("x", 5).Geo("y", 0).Geo("diametre_m", 0.35).Geo("hauteur_m", 3));
            r.Ouvrages.Add(new Ouvrage { Nom = "PX1 - RDC", Type = "poutre", IdExterne = "exemple-0005" }.Geo("x1", 0).Geo("y1", 0).Geo("x2", 5).Geo("y2", 0).Geo("b_m", 0.25).Geo("h_m", 0.45));
            r.Ouvrages.Add(new Ouvrage { Nom = "D1 - RDC", Type = "dalle", IdExterne = "exemple-0006" }.Geo("x", -0.3).Geo("y", -0.3).Geo("largeur_m", 5.6).Geo("longueur_m", 4).Geo("epaisseur_m", 0.2).Charge("g_kN_m2", 1.5).Charge("q_kN_m2", 2.5));
            r.Ouvrages.Add(new Ouvrage { Nom = "V1 - RDC", Type = "voile", IdExterne = "exemple-0007" }.Geo("x1", 0).Geo("y1", 4).Geo("x2", 5).Geo("y2", 4).Geo("epaisseur_m", 0.2).Geo("hauteur_m", 3));
            var u = new Niveau { Nom = "R+1", CoteM = 3 }; b.Niveaux.Add(u);
            u.Ouvrages.Add(new Ouvrage { Nom = "D1 - R+1", Type = "dalle", IdExterne = "exemple-0008" }.Geo("x", -0.3).Geo("y", -0.3).Geo("largeur_m", 5.6).Geo("longueur_m", 4).Geo("epaisseur_m", 0.2));
            return d;
        }

        [Fact]
        public void ExempleEstValide() { Assert.Empty(Controle.Verifier(Exemple())); }

        [Fact]
        public void SerialisationEgaleAuFichierExemple()
        {
            string ecrit = JsonEcriture.Ecrire(Exemple());
            string attendu = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "exemple-revit.json"));
            using (var a = JsonDocument.Parse(ecrit)) using (var b = JsonDocument.Parse(attendu))
                Assert.Equal(Canon(b.RootElement), Canon(a.RootElement));
        }

        static string Canon(JsonElement e) { return JsonSerializer.Serialize(e); }

        [Fact]
        public void PointDecimalMemeEnCultureFrancaise()
        {
            var ancienne = Thread.CurrentThread.CurrentCulture;
            try
            {
                Thread.CurrentThread.CurrentCulture = new CultureInfo("fr-FR");
                Assert.Equal("0.25", JsonEcriture.Nombre(0.25));
                Assert.Contains("\"cote_m\":-1.2", JsonEcriture.Ecrire(Exemple()));
            }
            finally { Thread.CurrentThread.CurrentCulture = ancienne; }
        }

        [Fact]
        public void ArrondiEtZeroNegatif() { Assert.Equal("0.3333", JsonEcriture.Nombre(1.0 / 3)); Assert.Equal("0", JsonEcriture.Nombre(-0.00001)); }

        [Fact]
        public void NombreNonFiniRefuse() { Assert.Throws<ArgumentException>(() => JsonEcriture.Nombre(double.NaN)); }

        [Fact]
        public void ChampAbsentReresteAbsent()
        {
            string j = JsonEcriture.Ecrire(Exemple());
            using (var doc = JsonDocument.Parse(j))
            {
                var fond = doc.RootElement.GetProperty("batiments")[0].GetProperty("niveaux")[0].GetProperty("ouvrages")[0];
                Assert.False(fond.TryGetProperty("charges", out _));
                Assert.False(fond.TryGetProperty("materiau", out _));
                Assert.False(doc.RootElement.GetProperty("projet").TryGetProperty("sol", out _));
                Assert.False(doc.RootElement.GetProperty("batiments")[0].GetProperty("niveaux")[2].TryGetProperty("hauteur_m", out _));
            }
        }

        [Fact]
        public void TexteEchappe() { Assert.Equal("\"a\\\"b\\\\c\\n\"", JsonEcriture.Texte("a\"b\\c\n")); }

        [Fact]
        public void NomsUniquesSansAccentNiCasse()
        {
            var u = new Noms.Unicite();
            Assert.Equal("P1", u.Rendre("P1"));
            Assert.Equal("p1 (2)", u.Rendre("p1"));
            Assert.Equal("Élément", u.Rendre("Élément"));
            Assert.Equal("element (2)", u.Rendre("element"));
            Assert.Equal("Sans nom", u.Rendre("  "));
        }

        [Fact]
        public void CleIdentiqueAL_Application() { Assert.Equal("coeur", Noms.Cle("  Cœur ")); Assert.Equal(Noms.Cle("RDC"), Noms.Cle("rdc")); }

        [Fact]
        public void NomLimiteA120() { Assert.True(Noms.Nettoyer(new string('a', 300)).Length <= 120); }

        [Fact]
        public void ControleDetecteLesProblemes()
        {
            var d = Exemple(); d.Batiments[0].Niveaux[1].Ouvrages[0].Nom = "S1 - Fondations";
            Assert.Contains(Controle.Verifier(d), m => m.Contains("déjà utilisé"));
            d = Exemple(); d.Batiments[0].Niveaux[1].Ouvrages[2].Geometrie.RemoveAll(k => k.Key == "h_m");
            Assert.Contains(Controle.Verifier(d), m => m.Contains("h_m"));
            d = Exemple(); d.Batiments[0].Niveaux[1].Ouvrages[0].Type = "tuyau";
            Assert.Contains(Controle.Verifier(d), m => m.Contains("type inconnu"));
            d = Exemple(); d.Batiments[0].Niveaux[1].Ouvrages[0].Charge("vent", 3);
            Assert.Contains(Controle.Verifier(d), m => m.Contains("vent"));
            d = Exemple(); d.ProjetNom = " ";
            Assert.Contains(Controle.Verifier(d), m => m.Contains("projet"));
        }

        [Fact]
        public void PoteauSectionOuDiametrePasLesDeux()
        {
            var d = Exemple(); d.Batiments[0].Niveaux[1].Ouvrages[0].Geo("diametre_m", 0.4);
            Assert.Contains(Controle.Verifier(d), m => m.Contains("poteau"));
        }

        [Fact]
        public void MateriauxLusDansLeNomSeulement()
        {
            Assert.Equal("C25/30", Materiaux.Beton("Béton armé C25/30"));
            Assert.Equal("C30/37", Materiaux.Beton("beton c 30 / 37"));
            Assert.Null(Materiaux.Beton("Béton"));
            Assert.Equal("B500A", Materiaux.Acier("Acier B500 A"));
            Assert.Null(Materiaux.Acier("Acier"));
            Assert.Null(Materiaux.Beton(null));
        }

        [Fact]
        public void NiveauLePlusProche()
        {
            var l = new[] { new CoteNiveau { Nom = "RDC", CoteM = 0 }, new CoteNiveau { Nom = "R+1", CoteM = 3 } };
            Assert.Equal("R+1", Niveaux.LePlusProche(l, 2.9).Nom);
            Assert.Equal("RDC", Niveaux.LePlusProche(l, -0.1).Nom);
            Assert.Null(Niveaux.LePlusProche(new CoteNiveau[0], 1));
        }

        [Fact]
        public void PiedsEnMetres() { Assert.Equal(0.3048, Unites.PiedsEnM(1), 9); Assert.Equal(3.048, Unites.PiedsEnM(10), 9); }

        [Fact]
        public void Types_Du_Contrat() { Assert.Contains("poteau", Contrat.Types); Assert.Equal(8, Contrat.Types.Length); Assert.Equal("1.0", Contrat.Version); }
    }
}
