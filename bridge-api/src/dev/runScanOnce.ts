import { contractService } from "../services/contract.service";
import { creWorkflowService } from "../services/creWorkflow.service";

async function main() {
  const addressArg =
    process.argv[2] || "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const address = addressArg.toLowerCase();

  let contract = null;

  // Ensure we have a monitored contract registered in the in-memory store
  try {
    contract = await contractService.addContract({
      address,
      name: "Sentinel Test Contract",
      protocol: "Normal",
      chain: "ethereum-testnet-sepolia",
      chainSelectorName: "ethereum-testnet-sepolia",
      chainName: "Ethereum Sepolia",
      rpcUrl: "https://rpc.ankr.com/eth_sepolia",
      priceFeeds: [],
      alertChannels: ["email"],
    });
    console.log("Added new contract:", contract);
  } catch (err: any) {
    if (err?.message?.includes("Contract already exists")) {
      contract = await contractService.getContract(address);
      console.log("Using existing contract:", contract);
    } else {
      console.error("Failed to add contract:", err);
      process.exit(1);
    }
  }

  if (!contract) {
    console.error("No contract available for scanning");
    process.exit(1);
  }

  console.log("Triggering CRE workflow scan for", contract.address);

  const result = await creWorkflowService.executeNormalWorkflow({
    action: "scan",
    contractAddress: contract.address,
    parameters: {
      contracts: [contract.address],
      priority: "normal",
    },
  });

  console.log("Workflow execution status:", result.status);

  const details = await contractService.getContractDetails(contract.address);
  console.log(
    "Contract detail after scan:\n",
    JSON.stringify(details, null, 2),
  );
}

main().catch((err) => {
  console.error("runScanOnce failed:", err);
  process.exit(1);
});

