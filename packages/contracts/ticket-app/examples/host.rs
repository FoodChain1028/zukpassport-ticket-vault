use clap::{Parser, Subcommand};
use ticket_app::client::tx_executor_handler::metadata::PROGRAM_ID;
use ticket_app::TicketApp;
use ticket_app::TicketAppAction;
use sdk::api::APIRegisterContract;
use sdk::{BlobTransaction, ZkContract};
use hyle_hyllar::HyllarAction;

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

    #[arg(long, default_value = "ticket-app")]
    pub contract_name: String,

    #[arg(long, default_value = "hyllar")]
    pub token_contract_name: String,

    #[arg(long, default_value = "10")]
    pub ticket_price: u128,

    #[arg(long, default_value = "bob.ticket-app")]
    pub id: String,
}

#[derive(Subcommand)]
enum Commands {
    Register {},
    BuyTicket,
    HasTicket,
}

#[tokio::main]
async fn main() {
    // Initialize tracing. In order to view logs, run `RUST_LOG=info cargo run`
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();

    let client = client_sdk::rest_client::NodeApiHttpClient::new(cli.host).unwrap();

    let contract_name = &cli.contract_name;
    let token_contract_name = &cli.token_contract_name;

    match cli.command {
        Commands::Register {} => {
            // Build initial state of contract
            let initial_state = TicketApp::new(
                vec![],
                (token_contract_name.clone().into(), cli.ticket_price),
            );
            println!("Initial state: {:?}", initial_state);

            // Send the transaction to register the contract
            let res = client
                .register_contract(&APIRegisterContract {
                    verifier: "risc0-1".into(),
                    program_id: sdk::ProgramId(PROGRAM_ID.to_vec()),
                    state_commitment: initial_state.commit(),
                    contract_name: contract_name.clone().into(),
                })
                .await
                .unwrap();
            println!("✅ Register contract tx sent. Tx hash: {}", res);
        }
        Commands::BuyTicket => {
            // Create the token transfer action for payment
            let transfer_action = HyllarAction::Transfer {
                recipient: contract_name.clone().into(),
                amount: cli.ticket_price,
            };

            // Create the buy ticket action
            let buy_action = TicketAppAction::BuyTicket;

            // Build the blob transaction with both actions
            let blobs = vec![
                sdk::Blob {
                    contract_name: contract_name.clone().into(),
                    data: sdk::BlobData(borsh::to_vec(&buy_action).expect("failed to encode BuyTicket action")),
                },
                sdk::Blob {
                    contract_name: token_contract_name.clone().into(),
                    data: sdk::BlobData(borsh::to_vec(&transfer_action).expect("failed to encode Transfer action")),
                },
            ];
            
            let blob_tx = BlobTransaction::new(cli.id.clone(), blobs.clone());

            // Send the blob transaction
            let blob_tx_hash = client.send_tx_blob(&blob_tx).await.unwrap();
            println!("✅ Blob tx sent. Tx hash: {}", blob_tx_hash);
        }
        Commands::HasTicket => {
            // Create the check ticket action
            let action = TicketAppAction::HasTicket;
            
            // Build the blob transaction
            let blobs = vec![sdk::Blob {
                contract_name: contract_name.clone().into(),
                data: sdk::BlobData(borsh::to_vec(&action).expect("failed to encode HasTicket action")),
            }];
            
            let blob_tx = BlobTransaction::new(cli.id.clone(), blobs.clone());

            // Send the blob transaction
            let blob_tx_hash = client.send_tx_blob(&blob_tx).await.unwrap();
            println!("✅ Blob tx sent. Tx hash: {}", blob_tx_hash);
        }
    }
}
