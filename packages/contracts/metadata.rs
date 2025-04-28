#[allow(unused)]
#[cfg(all(not(clippy), feature = "nonreproducible"))]
mod methods {
    include!(concat!(env!("OUT_DIR"), "/methods.rs"));
}

#[cfg(all(not(clippy), feature = "nonreproducible", feature = "all"))]
mod metadata {
    pub const TICKET_APP_ELF: &[u8] = crate::methods::TICKET_APP_ELF;
    pub const TICKET_APP_ID: [u8; 32] = sdk::to_u8_array(&crate::methods::TICKET_APP_ID);
}

#[cfg(any(clippy, not(feature = "nonreproducible")))]
mod metadata {
    pub const TICKET_APP_ELF: &[u8] =
        ticket_app::client::tx_executor_handler::metadata::TICKET_APP_ELF;
    pub const TICKET_APP_ID: [u8; 32] =
        ticket_app::client::tx_executor_handler::metadata::PROGRAM_ID;
}

pub use metadata::*;
