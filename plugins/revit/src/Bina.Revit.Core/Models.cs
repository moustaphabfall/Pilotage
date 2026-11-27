using System.Collections.Generic;

namespace Bina.Revit.Core
{
    /* Modèle du format d'échange « bina-descente-charge » version 1.0 (voir docs/plugin-echange.md). Longueurs en m, forces en kN. */
    public static class Contrat
    {
        public const string Format = "bina-descente-charge";
        public const string Version = "1.0";
        public static readonly string[] Types = { "dalle", "poutre", "poteau", "voile", "semelle", "pieu", "mur_soutenement", "escalier" };
        public static readonly string[] ChargesAdmises = { "G_kN", "Q_kN", "g_kN_m2", "q_kN_m2", "g_kN_m", "q_kN_m" };
    }

    public class DocEchange
    {
        public string Outil = "Revit";
        public string VersionOutil;
        public string VersionPlugin;
        public string DateExport;
        public string ProjetNom;
        public List<Batiment> Batiments = new List<Batiment>();
    }

    public class Batiment
    {
        public string Nom;
        public List<Niveau> Niveaux = new List<Niveau>();
    }

    public class Niveau
    {
        public string Nom;
        public double CoteM;
        public double? HauteurM;
        public List<Ouvrage> Ouvrages = new List<Ouvrage>();
    }

    public class Ouvrage
    {
        public string Nom;
        public string Type;
        public string IdExterne;
        /* Champs de géométrie dans l'ordre d'écriture (nom du champ -> valeur en m). */
        public List<KeyValuePair<string, double>> Geometrie = new List<KeyValuePair<string, double>>();
        /* Charges présentes dans le modèle seulement ; un champ absent n'est jamais écrit. */
        public List<KeyValuePair<string, double>> Charges = new List<KeyValuePair<string, double>>();
        public string Beton;
        public string Acier;

        public Ouvrage Geo(string champ, double valeur) { Geometrie.Add(new KeyValuePair<string, double>(champ, valeur)); return this; }
        public Ouvrage Charge(string champ, double valeur) { Charges.Add(new KeyValuePair<string, double>(champ, valeur)); return this; }
    }
}
