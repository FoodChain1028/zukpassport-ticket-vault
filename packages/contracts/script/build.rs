// use sp1_build::build_program_with_args;

// fn main() {
//     build_program_with_args("../program", Default::default())
// }

use sp1_helper::build_program_with_args;
use sp1_helper::BuildArgs; // Add this import

fn main() {
    let args = BuildArgs {
        ignore_rust_version: true,
        ..Default::default()
    };

    build_program_with_args("../program", args.clone());
    build_program_with_args("../../simple-identity-sp1/program", args.clone());
    build_program_with_args("../../simple-token-sp1/program", args.clone());
}
