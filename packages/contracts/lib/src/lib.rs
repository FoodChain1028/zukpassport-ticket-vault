mod constants;
mod countries;

use borsh::{io::Error, BorshDeserialize, BorshSerialize};
use sdk::{Digestable, HyleContract, RunResult};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

impl HyleContract for HyleTicket {
    /// Entry point of the contract's logic
    fn execute(&mut self, contract_input: &sdk::ContractInput) -> RunResult {
        // Parse contract inputs
        let (action, ctx) =
            sdk::utils::parse_raw_contract_input::<HyleTicketAction>(contract_input)?;
        // TODO: extract private_input from contract_input
        // let proof = ctx.private_input;

        // Execute the contract logic
        let res = match action {
            HyleTicketAction::Buy { recipient } => self.buy(&recipient)?,
            HyleTicketAction::Spend { ticket_id } => self.spend(ticket_id)?,
            HyleTicketAction::Transfer {
                ticket_id,
                recipient,
            } => self.transfer(ticket_id, &recipient)?,
        };

        // program_output might be used to give feedback to the user
        Ok((res, ctx, vec![]))
    }
}

/// The state of the contract
#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Debug, Clone)]
pub struct HyleTicket {
    pub tickets: BTreeMap<u64, String>,
    pub ticket_id: u64, // a global ticket id
}

/// The action represents the different operations that can be done on the contract
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum HyleTicketAction {
    Buy { recipient: String },
    Spend { ticket_id: u64 },
    Transfer { ticket_id: u64, recipient: String },
}

/// Utils function for the host
impl HyleTicket {
    /// Create a new instance of the ticket contract
    pub fn new() -> Self {
        HyleTicket {
            tickets: BTreeMap::new(),
            ticket_id: 0,
        }
    }

    /// Serializes the state of the contract
    pub fn as_bytes(&self) -> Result<Vec<u8>, Error> {
        borsh::to_vec(self)
    }
}

impl HyleTicket {
    /// Checks the identity of a specific ticket
    pub fn owner_of(&self, ticket_id: u64) -> Result<&String, String> {
        match self.tickets.get(&ticket_id) {
            Some(owner) => Ok(owner),
            None => Err(format!("Ticket ID {ticket_id} not found")),
        }
    }

    /// Buys a new ticket with a specific name and assigns it to the recipient identity.
    pub fn buy(&mut self, recipient: &str) -> Result<String, String> {
        let ticket_id = self.ticket_id;
        if self.tickets.contains_key(&ticket_id) {
            return Err(format!("Ticket ID {ticket_id} already exists"));
        }
        // TODO: add discount check && erc20 token contract to pay
        self.tickets.insert(ticket_id, recipient.to_string());
        self.ticket_id += 1;
        Ok(format!("Minted ticket {ticket_id} to {recipient}"))
    }

    /// Spends a ticket by removing it from the contract.
    pub fn spend(&mut self, ticket_id: u64) -> Result<String, String> {
        if !self.tickets.contains_key(&ticket_id) {
            return Err(format!("Ticket ID {ticket_id} not found"));
        }
        self.tickets.remove(&ticket_id);
        Ok(format!("Spent ticket {ticket_id}"))
    }

    /// Transfers a ticket to a new recipient.
    pub fn transfer(&mut self, ticket_id: u64, recipient: &str) -> Result<String, String> {
        if !self.tickets.contains_key(&ticket_id) {
            return Err(format!("Ticket ID {ticket_id} not found"));
        }
        // TODO: add discount check and repay here.
        self.tickets.insert(ticket_id, recipient.to_string());
        Ok(format!("Transferred ticket {ticket_id} to {recipient}"))
    }

    /// a mock verifier always return true now.
    pub fn verify() -> Result<bool, String> {
        Ok(true)
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
