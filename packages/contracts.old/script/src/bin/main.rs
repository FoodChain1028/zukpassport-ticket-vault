use clap::{Parser, Subcommand};

use client_sdk::helpers::sp1::SP1Prover;
use sdk::api::APIRegisterContract;
use sdk::BlobTransaction;
use sdk::Identity;
use sdk::ProofTransaction;
use sdk::{ContractInput, ContractName, HyleContract};
use sp1_identity_contract::{IdentityAction, IdentityContractState};
use sp1_sdk::include_elf;
use sp1_ticket_contract::{frontend_data::create_mock_fe_data, TicketAppAction, TicketAppState};
use sp1_token_contract::{SimpleToken, SimpleTokenAction};

pub const CONTRACT_ELF: &[u8] = include_elf!("contract_elf");
pub const IDENTITY_ELF: &[u8] = include_elf!("simple_identity");
pub const TOKEN_ELF: &[u8] = include_elf!("simple_token");

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    #[clap(long, short)]
    reproducible: bool,

    #[arg(long, default_value = "http://localhost:4321")]
    pub host: String,

    #[arg(long, default_value = "simple_ticket_app")]
    pub contract_name: String,

    #[arg(long, default_value = "examples.simple_ticket_app")]
    pub user: String,

    #[arg(long, default_value = "pass")]
    pub pass: String,

    #[arg(long, default_value = "0")]
    pub nonce: String,
}

#[derive(Subcommand)]
enum Commands {
    Register {
        token: String,
        price: u128,
    },
    BuyTicket {
        #[arg(long)]
        user: Option<String>,

        #[arg(long)]
        pass: Option<String>,

        #[arg(long)]
        nonce: Option<u32>,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing. In order to view logs, run `RUST_LOG=info cargo run`
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();

    let client = client_sdk::rest_client::NodeApiHttpClient::new(cli.host).unwrap();

    let contract_name = &cli.contract_name.clone();

    let ticket_prover = SP1Prover::new(CONTRACT_ELF);
    let identity_prover = SP1Prover::new(IDENTITY_ELF);
    let token_prover = SP1Prover::new(TOKEN_ELF);

    match cli.command {
        // cmd: cargo run -r -- register simple_token 10
        Commands::Register { token, price } => {
            // Build initial state of contract
            let initial_state = TicketAppState::new(vec![], (ContractName(token), price));
            println!("Initial state: {:?}", initial_state);
            println!("Initial State {:?}", initial_state.commit());

            let vk = serde_json::to_vec(&ticket_prover.vk).unwrap();

            // Send the transaction to register the contract
            let res = client
                .register_contract(&APIRegisterContract {
                    verifier: "sp1-4".into(),
                    program_id: sdk::ProgramId(vk),
                    state_commitment: initial_state.commit(),
                    contract_name: contract_name.clone().into(),
                })
                .await
                .unwrap();

            println!("✅ Register contract tx sent. Tx hash: {}", res);
        }
        // cmd: cargo run -r -- buy-ticket --user "bob.simple_identity" --pass "123123"
        Commands::BuyTicket { user, pass, nonce } => {
            // Build initial state of contract
            let initial_state: TicketAppState = client
                .get_contract(&contract_name.clone().into())
                .await
                .unwrap()
                .state
                .into();

            // Use command arguments or fall back to global CLI defaults
            let discount = 80;
            let username = user.unwrap_or_else(|| cli.user.clone());
            let password = pass.unwrap_or_else(|| cli.pass.clone());
            let nonce_value = nonce.unwrap_or_else(|| cli.nonce.parse().unwrap_or(0));

            println!("Initial State {:?}", &initial_state);
            println!("Initial State {:?}", initial_state.commit());
            println!("Identity {:?}", username);
            println!("Nonce {:?}", nonce_value);

            let identity = Identity(username);

            let identity_cf: IdentityAction = IdentityAction::VerifyIdentity {
                account: identity.0.clone(),
                nonce: nonce_value,
            };

            let identity_contract_name = identity
                .0
                .rsplit_once(".")
                .unwrap_or(("", "zupass_id"))
                .1
                .to_string();

            let blobs = vec![
                sdk::Blob {
                    contract_name: identity_contract_name.clone().into(),
                    data: sdk::BlobData(
                        borsh::to_vec(&identity_cf).expect("Failed to encode Identity action"),
                    ),
                },
                // Init pair 0 amount
                sdk::Blob {
                    contract_name: initial_state.ticket_price.0.clone(),
                    data: sdk::BlobData(
                        borsh::to_vec(&SimpleTokenAction::Transfer {
                            recipient: contract_name.clone(),
                            amount: initial_state.ticket_price.1 * discount,
                        })
                        .expect("Failed to encode Erc20 transfer action"),
                    ),
                },
                sdk::Blob {
                    contract_name: contract_name.clone().into(),
                    data: sdk::BlobData(
                        borsh::to_vec(&TicketAppAction::BuyTicket {})
                            .expect("Failed to encode Buy Ticket action"),
                    ),
                },
            ];

            println!("Blobs {:?}", blobs.clone());

            let blob_tx = BlobTransaction::new(identity.clone(), blobs.clone());

            // Send the blob transaction
            let blob_tx_hash = client.send_tx_blob(&blob_tx).await.unwrap();
            println!("✅ Blob tx sent. Tx hash: {}", blob_tx_hash);

            // TODO: change this into the real data from frontend
            let mock_frontend_data = create_mock_fe_data();

            // Serialize the mock data
            let serialized_data =
                borsh::to_vec(&mock_frontend_data).expect("Failed to serialize frontend data");

            // prove tx
            println!("Running and proving TicketApp blob");

            // Build the contract input with our serialized frontend data
            let inputs = ContractInput {
                state: initial_state.as_bytes().unwrap(),
                identity: identity.clone(),
                tx_hash: blob_tx_hash.clone().into(),
                private_input: serialized_data,
                tx_ctx: None,
                blobs: blobs.clone(),
                index: sdk::BlobIndex(2),
            };

            // Generate the zk proof
            //
            let proof = ticket_prover.prove(inputs).await.unwrap();

            let proof_tx = ProofTransaction {
                proof,
                contract_name: contract_name.clone().into(),
            };

            // Send the proof transaction
            let proof_tx_hash = client.send_tx_proof(&proof_tx).await.unwrap();
            println!("✅ Proof tx sent. Tx hash: {}", proof_tx_hash);

            println!("Running and proving Transfer blob");

            // Build the transfer a input
            let initial_state_a: SimpleToken = client
                .get_contract(&initial_state.ticket_price.0.clone().into())
                .await
                .unwrap()
                .state
                .into();

            let inputs = ContractInput {
                state: initial_state_a.as_bytes().unwrap(),
                identity: identity.clone(),
                tx_hash: blob_tx_hash.clone().into(),
                private_input: vec![],
                tx_ctx: None,
                blobs: blobs.clone(),
                index: sdk::BlobIndex(1),
            };

            // Generate the zk proof
            let proof = token_prover.prove(inputs).await.unwrap();

            let proof_tx = ProofTransaction {
                proof,
                contract_name: initial_state.ticket_price.0.clone(),
            };

            // Send the proof transaction
            let proof_tx_hash = client.send_tx_proof(&proof_tx).await.unwrap();
            println!("✅ Proof tx sent. Tx hash: {}", proof_tx_hash);

            println!("Running and proving Identity blob");

            // Fetch the initial state from the node
            let initial_state_id: IdentityContractState = client
                .get_contract(&identity_contract_name.clone().into())
                .await
                .unwrap()
                .state
                .into();

            // Build the contract input
            let inputs = ContractInput {
                state: initial_state_id.as_bytes().unwrap(),
                identity: identity.clone(),
                tx_hash: blob_tx_hash.clone().into(),
                private_input: password.into_bytes().to_vec(),
                tx_ctx: None,
                blobs: blobs.clone(),
                index: sdk::BlobIndex(0),
            };

            // Generate the zk proof
            let proof_result = identity_prover.prove(inputs).await;
            match proof_result {
                Ok(proof) => {
                    println!("✅ Identity proof generation successful");
                    let proof_tx = ProofTransaction {
                        proof,
                        contract_name: identity_contract_name.clone().into(),
                    };

                    // Send the proof transaction
                    match client.send_tx_proof(&proof_tx).await {
                        Ok(proof_tx_hash) => {
                            println!("✅ Proof tx sent. Tx hash: {}", proof_tx_hash);
                        }
                        Err(e) => {
                            println!("❌ Failed to send identity proof: {:?}", e);
                            return Ok(());
                        }
                    }
                }
                Err(e) => {
                    println!("❌ Identity proof failed: {:?}", e);
                    return Ok(());
                }
            }
        }
    }
    Ok(())
}
