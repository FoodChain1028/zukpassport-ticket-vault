use anyhow::Context;
use anyhow::Result;
use clap::{Parser, Subcommand};
use contract::HyleTicket;
use contract::HyleTicketAction;
use sdk::api::APIRegisterContract;
use sdk::BlobTransaction;
use sdk::HyleContract;
use sdk::ProofTransaction;
use sdk::{ContractInput, Digestable};

use sp1_sdk::{include_elf, ProverClient};

/// The ELF (executable and linkable format) file for the Succinct RISC-V zkVM.
pub const CONTRACT_ELF: &[u8] = include_elf!("contract_elf");

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    #[arg(long, default_value = "bob")]
    pub username: String,

    #[arg(long, default_value = "http://localhost:4321")]
    pub host: String,

    #[arg(long, default_value = "counter")]
    pub contract_name: String,
}

#[derive(Subcommand)]
enum Commands {
    RegisterContract {},
    Increment {},
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Client to send requests to the node
    let client = client_sdk::rest_client::NodeApiHttpClient::new(cli.host)?;
    let contract_name = &cli.contract_name;

    // This dummy example doesn't uses identities. But there are required fields & validation.
    let identity = format!("{}.{}", cli.username, contract_name);

    match cli.command {
        Commands::RegisterContract {} => {
            // Build initial state of contract
            let initial_state = HyleTicket {
                ticket_id: "1".to_string(),
            };

            println!("Computing contract's verification key...");

            let prover_client = ProverClient::from_env();
            let (_, vk) = prover_client.setup(CONTRACT_ELF);

            let vk = serde_json::to_vec(&vk).unwrap();

            // Send the transaction to register the contract
            let res = client
                .register_contract(&APIRegisterContract {
                    verifier: "sp1".into(),
                    program_id: sdk::ProgramId(vk),
                    state_digest: initial_state.as_digest(),
                    contract_name: contract_name.clone().into(),
                })
                .await?;
            println!("✅ Register contract tx sent. Tx hash: {}", res);
        }
        Commands::Increment {} => {
            // Fetch the initial state from the node
            let mut initial_state: HyleTicket = client
                .get_contract(&contract_name.clone().into())
                .await
                .unwrap()
                .state
                .into();

            // ----
            // Build the blob transaction
            // ----
            let action = HyleTicketAction::Buy {};
            let blobs = vec![action.as_blob(contract_name)];
            let blob_tx = BlobTransaction::new(identity.clone(), blobs.clone());

            // Send the blob transaction
            let blob_tx_hash = client.send_tx_blob(&blob_tx).await.unwrap();
            println!("✅ Blob tx sent. Tx hash: {}", blob_tx_hash);

            // ----
            // Prove the state transition
            // ----

            // Build the contract input
            let inputs = ContractInput {
                state: initial_state.as_bytes().unwrap(),
                identity: identity.clone().into(),
                tx_hash: blob_tx_hash,
                private_input: vec![],
                tx_ctx: None,
                blobs: blobs.clone(),
                index: sdk::BlobIndex(0),
            };

            let (program_outputs, _, _) = initial_state.execute(&inputs).unwrap();
            println!("🚀 Executed: {}", program_outputs);

            // Generate the zk proof
            let (proof, _) = client_sdk::helpers::sp1::prove(CONTRACT_ELF, &inputs)
                .context("failed to prove")?;

            // Build the Proof transaction
            let proof_tx = ProofTransaction {
                proof,
                contract_name: contract_name.clone().into(),
            };

            // Send the proof transaction
            let proof_tx_hash = client.send_tx_proof(&proof_tx).await.unwrap();
            println!("✅ Proof tx sent. Tx hash: {}", proof_tx_hash);
        }
    }
    Ok(())
}
