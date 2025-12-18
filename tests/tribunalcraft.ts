import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Tribunalcraft } from "../target/types/tribunalcraft";

describe("tribunalcraft", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Tribunalcraft as Program<Tribunalcraft>;

  it("Program is deployed", async () => {
    // Basic check that program exists
    console.log("Program ID:", program.programId.toString());
  });
});
