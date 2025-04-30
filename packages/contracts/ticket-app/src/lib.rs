use borsh::{io::Error, BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};

use hyle_hyllar::HyllarAction;
use sdk::{caller::ExecutionContext, BlobIndex, ContractName, Identity, RunResult};

use crate::constants::EU_COUNTRIES;

pub mod constants;

#[cfg(feature = "client")]
pub mod client;
#[cfg(feature = "client")]
pub mod indexer;

impl sdk::ZkContract for TicketApp {
    /// Entry point of the contract's logic
    fn execute(&mut self, calldata: &sdk::Calldata) -> RunResult {
        // Parse contract inputs
        let (action, ctx) = sdk::utils::parse_raw_calldata::<TicketAppAction>(calldata)?;

        let transfer_action =
            sdk::utils::parse_structured_blob::<HyllarAction>(&calldata.blobs, &BlobIndex(1))
                .ok_or("failed to parse hyllar action")?;

        let transfer_action_contract_name = calldata
            .blobs
            .get(&BlobIndex(1))
            .unwrap()
            .contract_name
            .clone();

        // Execute the given action
        let res = match action {
            TicketAppAction::BuyTicket { nationality } => self.buy_ticket(
                &ctx,
                &nationality,
                transfer_action.data.parameters,
                transfer_action_contract_name,
            )?,
            TicketAppAction::HasTicket => self.has_ticket(&ctx)?,
        };

        Ok((res, ctx, vec![]))
    }

    /// In this example, we serialize the full state on-chain.
    fn commit(&self) -> sdk::StateCommitment {
        sdk::StateCommitment(self.as_bytes().expect("Failed to encode TicketApp"))
    }
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Debug, Clone)]
pub enum TicketAppAction {
    BuyTicket { nationality: String },
    HasTicket,
}

impl TicketAppAction {
    pub fn as_blob(&self, contract_name: sdk::ContractName) -> sdk::Blob {
        sdk::Blob {
            contract_name,
            data: sdk::BlobData(borsh::to_vec(self).expect("Failed to encode TicketAppAction")),
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Debug, Clone)]
pub struct TicketApp {
    pub ticket_price: (ContractName, u128),
    pub tickets: Vec<Identity>,
}

impl Default for TicketApp {
    fn default() -> Self {
        TicketApp {
            // assume ContractName::from takes a &str, or replace with your constructor
            ticket_price: (ContractName::from("hyllar"), 10),
            tickets: Vec::new(),
        }
    }
}

/// Some helper methods for the state
impl TicketApp {
    pub fn new(tickets: Vec<Identity>, ticket_price: (ContractName, u128)) -> Self {
        TicketApp {
            tickets,
            ticket_price,
        }
    }

    pub fn buy_ticket(
        &mut self,
        ctx: &ExecutionContext,
        nationality: &str,
        erc20_action: HyllarAction,
        erc20_name: ContractName,
    ) -> Result<String, String> {
        // Check that a blob exists matching the given action, pop it from the callee blobs.

        let discount = if EU_COUNTRIES.contains(nationality) {
            90
        } else if nationality == "TWN" {
            80
        } else if nationality == "FRA" {
            80
        } else {
            100
        };

        // if self.tickets.contains(&ctx.caller) {
        //     return Err(format!("Ticket already present for {:?}", &ctx.caller));
        // }

        match erc20_action {
            HyllarAction::Transfer { recipient, amount } => {
                if recipient != ctx.contract_name.0 {
                    return Err(format!(
                        "Transfer recipient should be {} but was {}; nationality: {}",
                        ctx.contract_name, &recipient, nationality
                    ));
                }

                if self.ticket_price.0 != erc20_name {
                    return Err(format!(
                        "Transfer token should be {} but was {}",
                        self.ticket_price.0, &erc20_name
                    ));
                }

                // so this should match
                if amount < self.ticket_price.1 * discount {
                    return Err(format!(
                        "Transfer amount should be at least {} but was {}",
                        self.ticket_price.1 * discount,
                        amount
                    ));
                }
            }
            _ => {}
        }

        let program_outputs = format!("Ticket created for {:?}", ctx.caller);

        self.tickets.push(ctx.caller.clone());

        Ok(program_outputs)
    }

    pub fn has_ticket(&self, ctx: &ExecutionContext) -> Result<String, String> {
        if self.tickets.contains(&ctx.caller) {
            Ok(format!("Ticket present for {:?}", &ctx.caller))
        } else {
            Err(format!("No Ticket for {:?}", &ctx.caller))
        }
    }

    pub fn as_bytes(&self) -> Result<Vec<u8>, Error> {
        borsh::to_vec(self)
    }
}

impl From<sdk::StateCommitment> for TicketApp {
    fn from(state: sdk::StateCommitment) -> Self {
        borsh::from_slice(&state.0)
            .map_err(|_| "Could not decode TicketApp state".to_string())
            .unwrap()
    }
}
