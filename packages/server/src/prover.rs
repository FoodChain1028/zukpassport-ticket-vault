use std::sync::Arc;

use crate::app::{AppEvent, AppModuleCtx};
use anyhow::{anyhow, Context, Result};
use client_sdk::helpers::risc0::Risc0Prover;
use client_sdk::rest_client::NodeApiHttpClient;
use hyle::{
    bus::BusClientSender,
    log_error, module_handle_messages,
    node_state::module::NodeStateEvent,
    utils::modules::{module_bus_client, Module},
};
use hyle_hydentity::Hydentity;
use hyle_hyllar::Hyllar;
use sdk::{
    BlobIndex, BlobTransaction, Block, BlockHeight, Calldata, Hashed, ProofTransaction,
    TransactionData, TxHash, ZkContract, HYLE_TESTNET_CHAIN_ID,
};
use ticket_app::TicketApp;
use tracing::{error, info};

pub struct ProverModule {
    bus: ProverModuleBusClient,
    ctx: Arc<ProverModuleCtx>,
    unsettled_txs: Vec<BlobTransaction>,
    ticket_app: TicketApp,
    hydentity: Hydentity,
    hyllar: Hyllar,
}

module_bus_client! {
#[derive(Debug)]
pub struct ProverModuleBusClient {
    sender(AppEvent),
    receiver(NodeStateEvent),
}
}
pub struct ProverModuleCtx {
    pub app: Arc<AppModuleCtx>,
    pub start_height: BlockHeight,
}

impl Module for ProverModule {
    type Context = Arc<ProverModuleCtx>;

    async fn build(ctx: Self::Context) -> Result<Self> {
        let bus = ProverModuleBusClient::new_from_bus(ctx.app.common.bus.new_handle()).await;

        let ticket_app = TicketApp::default();
        let hydentity = Hydentity::default();
        let hyllar = Hyllar::default();

        Ok(ProverModule {
            bus,
            ticket_app,
            hydentity,
            hyllar,
            ctx,
            unsettled_txs: vec![],
        })
    }

    async fn run(&mut self) -> Result<()> {
        module_handle_messages! {
            on_bus self.bus,
            listen<NodeStateEvent> event => {
                _ = log_error!(self.handle_node_state_event(event).await, "handle note state event")
            }

        };

        Ok(())
    }
}

impl ProverModule {
    async fn handle_node_state_event(&mut self, event: NodeStateEvent) -> Result<()> {
        let NodeStateEvent::NewBlock(block) = event;
        self.handle_processed_block(*block).await?;

        Ok(())
    }

    async fn handle_processed_block(&mut self, block: Block) -> Result<()> {
        for (_, tx) in block.txs {
            if let TransactionData::Blob(tx) = tx.transaction_data {
                let tx_ctx = sdk::TxContext {
                    block_height: block.block_height,
                    block_hash: block.hash.clone(),
                    timestamp: block.block_timestamp.clone(),
                    lane_id: block.lane_ids.get(&tx.hashed()).unwrap().clone(),
                    chain_id: HYLE_TESTNET_CHAIN_ID,
                };
                self.handle_blob(tx, tx_ctx);
            }
        }

        for s_tx in block.successful_txs {
            self.settle_tx(s_tx)?;
        }

        for timedout in block.timed_out_txs {
            self.settle_tx(timedout)?;
        }

        for failed in block.failed_txs {
            self.settle_tx(failed)?;
        }

        Ok(())
    }

    fn handle_blob(&mut self, tx: BlobTransaction, tx_ctx: sdk::TxContext) {
        for (index, blob) in tx.blobs.iter().enumerate() {
            if blob.contract_name == self.ctx.app.ticket_app_cn {
                self.prove_ticket_app_blob(&index.into(), &tx, &tx_ctx);
            } else if blob.contract_name == self.ctx.app.hydentity_cn {
                self.prove_hydentity_blob(&index.into(), &tx, &tx_ctx);
            } else if blob.contract_name == self.ctx.app.hyllar_cn {
                self.prove_hyllar_blob(&index.into(), &tx, &tx_ctx);
            }
        }
        self.unsettled_txs.push(tx);
    }

    fn settle_tx(&mut self, tx: TxHash) -> Result<usize> {
        let tx = self.unsettled_txs.iter().position(|t| t.hashed() == tx);
        if let Some(pos) = tx {
            self.unsettled_txs.remove(pos);
            Ok(pos)
        } else {
            Ok(0)
        }
    }

    fn prove_hyllar_blob(
        &mut self,
        blob_index: &BlobIndex,
        tx: &BlobTransaction,
        tx_ctx: &sdk::TxContext,
    ) {
        let blob = tx.blobs.get(blob_index.0).unwrap();
        let blobs = tx.blobs.clone();
        let tx_hash = tx.hashed();

        let prover =
            Risc0Prover::new(hyle_hyllar::client::tx_executor_handler::metadata::HYLLAR_ELF);

        info!("Proving tx: {}. Blob for {}", tx_hash, blob.contract_name);

        let state = self.hyllar.to_bytes();
        let commitment_metadata = state;

        let calldata = Calldata {
            identity: tx.identity.clone(),
            tx_hash: tx_hash.clone(),
            private_input: vec![],
            blobs: blobs.clone().into(),
            index: *blob_index,
            tx_ctx: Some(tx_ctx.clone()),
            tx_blob_count: blobs.len(),
        };

        if let Err(e) = self.hyllar.execute(&calldata).map_err(|e| anyhow!(e)) {
            error!("error while executing contract: {e}");
            self.bus
                .send(AppEvent::FailedTx(tx_hash.clone(), e.to_string()))
                .unwrap();
        }

        //if its historical blocks do not send the proofs
        if tx_ctx.block_height.0 < self.ctx.start_height.0 {
            return;
        }
        self.bus
            .send(AppEvent::SequencedTx(tx_hash.clone()))
            .unwrap();

        let node_client = self.ctx.app.node_client.clone();
        let blob = blob.clone();
        tokio::task::spawn(async move {
            match prover.prove(commitment_metadata, calldata).await {
                Ok(proof) => {
                    info!("Proof generated for tx: {}", tx_hash);
                    let tx = ProofTransaction {
                        contract_name: blob.contract_name.clone(),
                        proof,
                    };
                    let _ = log_error!(
                        node_client.send_tx_proof(&tx).await,
                        "failed to send proof to node"
                    );
                }
                Err(e) => {
                    error!("Error proving tx: {:?}", e);
                }
            };
        });
    }

    fn prove_hydentity_blob(
        &mut self,
        blob_index: &BlobIndex,
        tx: &BlobTransaction,
        tx_ctx: &sdk::TxContext,
    ) {
        let blob = tx.blobs.get(blob_index.0).unwrap();
        let blobs = tx.blobs.clone();
        let tx_hash = tx.hashed();

        let prover =
            Risc0Prover::new(hyle_hydentity::client::tx_executor_handler::metadata::HYDENTITY_ELF);

        info!(
            "Proving tx: {}. Blob for {}. Identity: {}",
            tx_hash, blob.contract_name, tx.identity
        );

        let Ok(state) = self.hydentity.as_bytes() else {
            error!("Failed to serialize state on tx: {}", tx_hash);
            return;
        };

        let commitment_metadata = state;

        let calldata = Calldata {
            identity: tx.identity.clone(),
            tx_hash: tx_hash.clone(),
            private_input: "password".as_bytes().into(),
            blobs: blobs.clone().into(),
            index: *blob_index,
            tx_ctx: Some(tx_ctx.clone()),
            tx_blob_count: blobs.len(),
        };

        if let Err(e) = self.hydentity.execute(&calldata).map_err(|e| anyhow!(e)) {
            error!("error while executing contract: {e}");
            self.bus
                .send(AppEvent::FailedTx(tx_hash.clone(), e.to_string()))
                .unwrap();
        }

        //if its historical blocks do not send the proofs
        if tx_ctx.block_height.0 < self.ctx.start_height.0 {
            return;
        }
        self.bus
            .send(AppEvent::SequencedTx(tx_hash.clone()))
            .unwrap();

        let node_client = self.ctx.app.node_client.clone();
        let blob = blob.clone();
        tokio::task::spawn(async move {
            match prover.prove(commitment_metadata, calldata).await {
                Ok(proof) => {
                    info!("Proof generated for tx: {}", tx_hash);
                    let tx = ProofTransaction {
                        contract_name: blob.contract_name.clone(),
                        proof,
                    };
                    let _ = log_error!(
                        node_client.send_tx_proof(&tx).await,
                        "failed to send proof to node"
                    );
                }
                Err(e) => {
                    error!("Error proving tx: {:?}", e);
                }
            };
        });
    }

    fn prove_ticket_app_blob(
        &mut self,
        blob_index: &BlobIndex,
        tx: &BlobTransaction,
        tx_ctx: &sdk::TxContext,
    ) {
        if tx_ctx.block_height.0 < self.ctx.start_height.0 {
            return;
        }
        let blob = tx.blobs.get(blob_index.0).unwrap();
        let blobs = tx.blobs.clone();
        let tx_hash = tx.hashed();

        let prover =
            Risc0Prover::new(ticket_app::client::tx_executor_handler::metadata::TICKET_APP_ELF);

        info!("Proving tx: {}. Blob for {}", tx_hash, blob.contract_name);

        let Ok(state) = self.ticket_app.as_bytes() else {
            error!("Failed to serialize state on tx: {}", tx_hash);
            return;
        };

        let commitment_metadata = state;

        let calldata = Calldata {
            identity: tx.identity.clone(),
            tx_hash: tx_hash.clone(),
            private_input: vec![],
            blobs: blobs.clone().into(),
            index: *blob_index,
            tx_ctx: Some(tx_ctx.clone()),
            tx_blob_count: blobs.len(),
        };

        if let Err(e) = self.ticket_app.execute(&calldata).map_err(|e| anyhow!(e)) {
            error!("error while executing contract: {e}");
            self.bus
                .send(AppEvent::FailedTx(tx_hash.clone(), e.to_string()))
                .unwrap();
        }

        self.bus
            .send(AppEvent::SequencedTx(tx_hash.clone()))
            .unwrap();

        let node_client = self.ctx.app.node_client.clone();
        let blob = blob.clone();
        tokio::task::spawn(async move {
            match prover.prove(commitment_metadata, calldata).await {
                Ok(proof) => {
                    info!("Proof generated for tx: {}", tx_hash);
                    let tx = ProofTransaction {
                        contract_name: blob.contract_name.clone(),
                        proof,
                    };
                    let _ = log_error!(
                        node_client.send_tx_proof(&tx).await,
                        "failed to send proof to node"
                    );
                }
                Err(e) => {
                    error!("Error proving tx: {:?}", e);
                }
            };
        });
    }
}
