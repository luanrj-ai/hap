/**
 * Generate language-agnostic JSON Schema for the HAP v0.2 messages from the
 * canonical Zod definitions, so any-language agents can validate/implement.
 *
 *   npm run spec:schemas   (needs: npm i -D zod-to-json-schema)
 *
 * Output (committed): spec/schemas/*.schema.json. The Zod schemas in
 * @hap/a2a-adapter remain the single source of truth; re-run when they change.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { PostingZ, ApplicationZ, ReceiptZ, ProfileCardZ } from "@hap/a2a-adapter";

const OUT = resolve(process.cwd(), "spec", "schemas");
mkdirSync(OUT, { recursive: true });

const targets = [
  ["posting", PostingZ],
  ["application", ApplicationZ],
  ["receipt", ReceiptZ],
  ["profile", ProfileCardZ],
] as const;

for (const [name, schema] of targets) {
  const json = zodToJsonSchema(schema, { name: `hap.${name}`, $refStrategy: "none" });
  writeFileSync(resolve(OUT, `${name}.schema.json`), JSON.stringify(json, null, 2) + "\n");
  console.log(`wrote spec/schemas/${name}.schema.json`);
}
