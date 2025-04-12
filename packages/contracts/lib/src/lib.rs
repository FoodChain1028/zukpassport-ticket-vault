mod constants;
mod countries;

use borsh::{io::Error, BorshDeserialize, BorshSerialize};
use constants::EU_COUNTRIES;
use sdk::{Digestable, HyleContract, RunResult};
use serde::{Deserialize, Serialize};

impl HyleContract for HyleTicket {
    /// Entry point of the contract's logic
    fn execute(&mut self, contract_input: &sdk::ContractInput) -> RunResult {
        // Parse contract inputs
        let (action, ctx) =
            sdk::utils::parse_raw_contract_input::<HyleTicketAction>(contract_input)?;

        // Execute the contract logic
        match action {
            HyleTicketAction::Buy => {
                // TODO: 1. send tx to celo for registry proof? // this should be done in self backend
                // TODO: 2. verify the disclosure proof from selfxyz
                // TODO: 3. check discount according to the nationality
                // TODO:    4.1 extract disclosure country from contract input
                // let disclosure_country = contract_input
                // TODO:    4.2 check discount
                // TODO: 4. issue the ticket
            }
            HyleTicketAction::Spend => {
                // TODO: 1. verify the proof
            }
            HyleTicketAction::Transfer => {
                // TODO: 1. verify the proof
                // TODO: 2. check the nationality of original ticket
                // how do we check this?
            }
        };

        // program_output might be used to give feedback to the user
        let program_output = format!("new value: {}", 1);
        Ok((program_output, ctx, vec![]))
    }
}

/// The action represents the different operations that can be done on the contract
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum HyleTicketAction {
    // define function interface in thie enum:
    Buy,
    Spend,
    Transfer,
}

/// The state of the contract, in this example it is fully serialized on-chain
#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Debug, Clone)]
pub struct HyleTicket {
    pub ticket_id: String, // a global ticket id
}

/// Utils function for the host
impl HyleTicket {
    pub fn as_bytes(&self) -> Result<Vec<u8>, Error> {
        borsh::to_vec(self)
    }
}

/// Utils function for the host
impl HyleTicketAction {
    pub fn as_blob(&self, contract_name: &str) -> sdk::Blob {
        sdk::Blob {
            contract_name: contract_name.into(),
            data: sdk::BlobData(borsh::to_vec(self).expect("failed to encode BlobData")),
        }
    }
}

/// Helpers to transform the contrat's state in its on-chain state digest version.
/// In an optimal version, you would here only returns a hash of the state,
/// while storing the full-state off-chain
impl Digestable for HyleTicket {
    fn as_digest(&self) -> sdk::StateDigest {
        sdk::StateDigest(borsh::to_vec(self).expect("Failed to encode Balances"))
    }
}
impl From<sdk::StateDigest> for HyleTicket {
    fn from(state: sdk::StateDigest) -> Self {
        borsh::from_slice(&state.0)
            .map_err(|_| "Could not decode hyllar state".to_string())
            .unwrap()
    }
}
