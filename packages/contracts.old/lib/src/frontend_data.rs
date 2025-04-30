use borsh::{BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Debug, Clone)]
pub struct Groth16Proof {
    pub a: Vec<String>,
    pub b: Vec<Vec<String>>,
    pub c: Vec<String>,
    pub protocol: String,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Debug, Clone)]
pub struct PassportData {
    pub nationality: String,
    pub name: String,
    pub older_than: String,
    pub proof: Groth16Proof,
    pub public_signal: Vec<String>,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Debug, Clone)]
pub struct FrontendData {
    pub data_type: String,
    pub passport: PassportData,
}

impl std::fmt::Display for FrontendData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::fmt::Display for PassportData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{{ nationality: {:?}\n, name: {:?}\n, older_than: {:?}\n, proof: {:?}\n, public_signal: {:?}\n }}",
            self.nationality, self.name, self.older_than, self.proof, self.public_signal
        )
    }
}

impl std::fmt::Display for Groth16Proof {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{{ a: {:?}\n, b: {:?}\n, c: {:?}\n, protocol: {:?}\n }}",
            self.a, self.b, self.c, self.protocol
        )
    }
}

// A mock data to mimick data from frontend
pub fn create_mock_fe_data() -> FrontendData {
    FrontendData {
        data_type: "pod-pcd".to_string(),
        passport: PassportData {
            nationality: "TWN".to_string(),
            name: "[\"BO BO\",\"CHANG\"]".to_string(),
            older_than: "14".to_string(),
            proof: Groth16Proof {
                a: vec![
                    "2218721293884717613638497048031931256188091742657509215368815339884510653958".to_string(),
                    "2335713794755967637373876271044790175419374397897645565387294099657096854730".to_string(),
                ],
                b: vec![
                    vec![
                        "19757409220170500343285743778763186834506143480073384527974078140890075749557".to_string(),
                        "11858899837098785153750971939927389636144504193705266730580625368764272240026".to_string(),
                    ],
                    vec![
                        "18903316782007708002900817992404286086354421525811570045190715751961435850855".to_string(),
                        "10543008542953568680830684611434449942479727121974715599974985711092315896196".to_string(),
                    ],
                ],
                c: vec![
                    "9278308187848034359334492181158873226676949896135630083735738926547828526901".to_string(),
                    "3139679080712225980046420754840723260314838295194005369286231133550443547430".to_string(),
                ],
                protocol: "groth16".to_string(),
            },
            public_signal: vec![
                "0".to_string(),
                "125889334977186806473352390500834239990475522024106426917453824".to_string(),
                "1773781688717606310397756023428205332782362187156068670010833396561870848".to_string(),
                "6818352527182560077653388211384938507686473".to_string(),
                "0".to_string(),
                "0".to_string(),
                "10835404866968350488997494789445741373264055340251670148013289434802701779647".to_string(),
                "1".to_string(),
                "4519248318244936163329960176763313112511812759452292689850158372191562072786".to_string(),
            ],
        },
    }
}
