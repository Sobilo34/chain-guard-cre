// minimal-test.ts
// Minimal test workflow to identify WASM issues

import { cre, type Runtime, type CronPayload } from "@chainlink/cre-sdk";
import { z } from "zod";

// Minimal config schema
const configSchema = z.object({
  testValue: z.string().optional(),
});

type Config = z.infer<typeof configSchema>;

// Minimal cron handler
const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
  runtime.log("Test cron triggered!");
  return "Success";
};

// Main export
export function main() {
  return (config: Config) => {
    const cronCapability = new cre.capabilities.CronCapability();
    
    return [
      cre.handler(
        cronCapability.trigger({
          schedule: "*/5 * * * *",
        }),
        onCronTrigger
      ),
    ];
  };
}
