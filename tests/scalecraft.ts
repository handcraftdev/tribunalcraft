import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Scalecraft } from "../target/types/scalecraft";

describe("scalecraft", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Scalecraft as Program<Scalecraft>;

  it("Program is deployed", async () => {
    // Basic check that program exists
    console.log("Program ID:", program.programId.toString());
  });
});
