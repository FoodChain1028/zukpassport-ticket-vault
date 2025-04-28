use lazy_static::lazy_static;
use std::collections::HashSet;

// reference from https://github.com/zkpassport/zkpassport-utils/blob/main/src/constants/index.ts
// List of countries that are sanctioned by the US government.
lazy_static! {
    pub static ref SANCTIONED_COUNTRIES: HashSet<&'static str> = {
        let mut countries = HashSet::new();
        countries.extend(vec![
            "North Korea",
            "Iran",
            "Iraq",
            "Libya",
            "Somalia",
            "Sudan",
            "Syrian Arab Republic",
            "Yemen",
        ]);
        countries
    };
}

// List of countries that are part of the European Union.
lazy_static! {
    pub static ref EU_COUNTRIES: HashSet<&'static str> = {
        let mut countries = HashSet::new();
        countries.extend(vec![
            "Austria",
            "Belgium",
            "Bulgaria",
            "Croatia",
            "Cyprus",
            "Czech Republic",
            "Denmark",
            "Estonia",
            "Finland",
            "France",
            "Germany",
            "Greece",
            "Hungary",
            "Ireland",
            "Italy",
            "Latvia",
            "Lithuania",
            "Luxembourg",
            "Malta",
            "Netherlands",
            "Poland",
            "Portugal",
            "Romania",
            "Slovakia",
            "Slovenia",
            "Spain",
            "Sweden",
            "FRA",
        ]);
        countries
    };
}

// List of countries that are part of the European Economic Area.
lazy_static! {
    pub static ref EEA_COUNTRIES: HashSet<&'static str> = {
        let mut countries = EU_COUNTRIES.clone();
        countries.extend(vec!["Iceland", "Liechtenstein", "Norway"]);
        countries
    };
}

// List of countries that are part of the Schengen Area.
lazy_static! {
    pub static ref SCHENGEN_COUNTRIES: HashSet<&'static str> = {
        let mut countries = EU_COUNTRIES.clone();
        countries.extend(vec!["Switzerland", "Iceland", "Liechtenstein", "Norway"]);
        countries
    };
}

// List of countries that are part of the Association of Southeast Asian Nations.
lazy_static! {
    pub static ref ASEAN_COUNTRIES: HashSet<&'static str> = {
        let mut countries = HashSet::new();
        countries.extend(vec![
            "Brunei Darussalam",
            "Cambodia",
            "Indonesia",
            "Lao People's Democratic Republic",
            "Malaysia",
            "Myanmar",
            "Philippines",
            "Singapore",
            "Thailand",
            "Vietnam",
        ]);
        countries
    };
}

// List of countries that are part of the Mercosur.
lazy_static! {
    pub static ref MERCOSUR_COUNTRIES: HashSet<&'static str> = {
        let mut countries = HashSet::new();
        countries.extend(vec![
            "Argentina",
            "Brazil",
            "Chile",
            "Colombia",
            "Paraguay",
            "Uruguay",
        ]);
        countries
    };
}
