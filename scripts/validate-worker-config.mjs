import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const CONFIG_PATH = resolve("worker/wrangler.jsonc");
const KV_ID_PATTERN = /^[a-f\d]{32}$/i;
const PLACEHOLDER_ID = "00000000000000000000000000000000";

function removeJsonComments(value) {
  return value.replace(/\/\/[^\r\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function fail(message) {
  console.error(`worker deploy blocked: ${message}`);
  process.exitCode = 1;
}

let config;
try {
  const rawConfig = await readFile(CONFIG_PATH, "utf8");
  config = JSON.parse(removeJsonComments(rawConfig));
} catch (error) {
  fail(`worker/wrangler.jsonc を読み取れない、またはJSONCとして解析できません: ${error.message}`);
}

if (config) {
  const namespaces = config.kv_namespaces;
  if (!Array.isArray(namespaces) || namespaces.length === 0) {
    fail("kv_namespaces が設定されていません。");
  } else {
    if (!namespaces.some((namespace) => namespace?.binding === "RATE_CACHE")) {
      fail("RATE_CACHE binding が設定されていません。");
    }
    for (const namespace of namespaces) {
      const binding = namespace?.binding ?? "(binding未設定)";
      const id = namespace?.id;
      const previewId = namespace?.preview_id;

      if (typeof id !== "string" || !KV_ID_PATTERN.test(id)) {
        fail(`${binding}.id は32桁の16進KV namespace IDである必要があります。`);
      } else if (id.toLowerCase() === PLACEHOLDER_ID) {
        fail(`${binding}.id は全ゼロのplaceholderです。本番KV IDを設定してください。`);
      }

      if (typeof previewId !== "string" || !KV_ID_PATTERN.test(previewId)) {
        fail(`${binding}.preview_id は32桁の16進KV namespace IDである必要があります。`);
      } else if (previewId.toLowerCase() === PLACEHOLDER_ID) {
        fail(`${binding}.preview_id は全ゼロのplaceholderです。Preview用KV IDを設定してください。`);
      }

      if (
        typeof id === "string" &&
        typeof previewId === "string" &&
        id.toLowerCase() === previewId.toLowerCase()
      ) {
        fail(`${binding}.id と preview_id は同一にできません。Production/Previewには別KV namespaceを設定してください。`);
      }
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("worker deploy guard passed: KV namespace IDs are valid and separated.");
