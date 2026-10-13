import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse } from 'dotenv';
import { convertV2 } from 'openapi-to-postmanv2';

import {
  APPS_DIRECTORY,
  BASE_URL_VARIABLE_SUFFIX,
  COLLECTIONS_DIRECTORY,
  COMBINED_COLLECTION_FILE,
  COMBINED_COLLECTION_NAME,
  CONVERTER_BASE_URL_VARIABLE,
  CONVERTER_OPTIONS,
  CONVERTER_VARIABLE_RENAMES,
  FETCH_TIMEOUT_MILLISECONDS,
  OPENAPI_JSON_PATH,
  OUTPUT_DIRECTORY,
  POSTMAN_COLLECTION_SCHEMA,
  SWAGGER_SETUP_MARKER,
} from './postman.constant';
import { CollectionStatusEnum } from './postman.enum';
import type {
  CollectionResult,
  PostmanCollection,
  PostmanItem,
} from './postman.interface';

// A service is an app with its own main.ts; e2e projects have none.
function listServices(): string[] {
  return fs
    .readdirSync(APPS_DIRECTORY)
    .filter((name) =>
      fs.existsSync(path.join(APPS_DIRECTORY, name, 'src/main.ts')),
    )
    .sort();
}

function convertSpecification(
  specification: object,
): Promise<PostmanCollection> {
  return new Promise((resolve, reject) => {
    convertV2(
      { type: 'json', data: specification },
      CONVERTER_OPTIONS,
      (error, result) => {
        if (error) {
          reject(new Error(error.message));
        } else if (!result.result) {
          reject(new Error(result.reason));
        } else {
          resolve(result.output[0].data as PostmanCollection);
        }
      },
    );
  });
}

function countRequests(items: PostmanItem[]): number {
  return items.reduce(
    (total, item) => total + (item.item ? countRequests(item.item) : 1),
    0,
  );
}

async function generateCollection(service: string): Promise<CollectionResult> {
  const serviceDirectory = path.join(APPS_DIRECTORY, service);
  const main = fs.readFileSync(
    path.join(serviceDirectory, 'src/main.ts'),
    'utf8',
  );

  if (!main.includes(SWAGGER_SETUP_MARKER)) {
    return {
      service,
      status: CollectionStatusEnum.SKIPPED,
      detail: 'no Swagger setup in main.ts',
    };
  }

  const envFile = path.join(serviceDirectory, '.env');

  if (!fs.existsSync(envFile)) {
    return {
      service,
      status: CollectionStatusEnum.SKIPPED,
      detail: 'no .env, so no PORT',
    };
  }

  const port = parse(fs.readFileSync(envFile)).PORT;

  if (!port) {
    return {
      service,
      status: CollectionStatusEnum.SKIPPED,
      detail: 'no PORT in .env',
    };
  }

  const baseUrl = `http://localhost:${port}`;
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${OPENAPI_JSON_PATH}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MILLISECONDS),
    });
  } catch {
    return {
      service,
      status: CollectionStatusEnum.SKIPPED,
      detail: `not running on ${baseUrl}`,
    };
  }

  if (!response.ok) {
    return {
      service,
      status: CollectionStatusEnum.SKIPPED,
      detail: `${OPENAPI_JSON_PATH} returned ${response.status}`,
    };
  }

  try {
    const collection = await convertSpecification(await response.json());

    // Named per service, so one Postman environment can set every service's
    // URL without one shared name overriding them all.
    const baseUrlVariable = toBaseUrlVariable(service);
    const renames = {
      ...CONVERTER_VARIABLE_RENAMES,
      [CONVERTER_BASE_URL_VARIABLE]: baseUrlVariable,
    };

    collection.item = Object.entries(renames).reduce(
      (items, [from, to]) => renameVariable(items, from, to),
      collection.item,
    );
    // The spec declares no servers, so the converter's base URL is only '/'.
    collection.variable = [
      ...(collection.variable ?? []).filter(
        (variable) => variable.key !== CONVERTER_BASE_URL_VARIABLE,
      ),
      { key: baseUrlVariable, value: baseUrl, type: 'string' },
    ];

    const outputFile = path.join(
      COLLECTIONS_DIRECTORY,
      `${service}.postman_collection.json`,
    );

    writeCollection(outputFile, collection);

    return {
      service,
      status: CollectionStatusEnum.CREATED,
      detail: `${countRequests(collection.item)} requests → ${outputFile}`,
      collection,
    };
  } catch (error) {
    return {
      service,
      status: CollectionStatusEnum.FAILED,
      detail: (error as Error).message,
    };
  }
}

function renameVariable(
  items: PostmanItem[],
  from: string,
  to: string,
): PostmanItem[] {
  return JSON.parse(
    JSON.stringify(items).replaceAll(`{{${from}}}`, `{{${to}}}`),
  );
}

function toBaseUrlVariable(service: string): string {
  return `${service.replaceAll('-', '_')}_${BASE_URL_VARIABLE_SUFFIX}`;
}

// One folder per service. Variable names are already unique per service, so
// the per-service collections merge as they are.
function buildCombinedCollection(
  created: CollectionResult[],
): PostmanCollection {
  return {
    info: {
      name: COMBINED_COLLECTION_NAME,
      schema: POSTMAN_COLLECTION_SCHEMA,
    },
    item: created.map((result) => ({
      name: result.collection.info.name,
      description: result.collection.info.description,
      item: result.collection.item,
    })),
    variable: created.flatMap((result) => result.collection.variable),
  };
}

function writeCollection(file: string, collection: PostmanCollection): void {
  fs.writeFileSync(file, `${JSON.stringify(collection, null, 2)}\n`);
}

function printSummary(
  results: CollectionResult[],
  combined: PostmanCollection | null,
): void {
  const nameWidth = Math.max(...results.map((result) => result.service.length));

  console.log(`\nPostman collections (${OUTPUT_DIRECTORY})\n`);

  for (const result of results) {
    console.log(
      `  ${result.status.padEnd(7)}  ${result.service.padEnd(nameWidth)}  ${result.detail}`,
    );
  }

  const count = (status: CollectionStatusEnum) =>
    results.filter((result) => result.status === status).length;

  console.log(
    `\nCreated ${count(CollectionStatusEnum.CREATED)}, skipped ${count(CollectionStatusEnum.SKIPPED)}, failed ${count(CollectionStatusEnum.FAILED)}`,
  );
  console.log(
    combined
      ? `Combined ${combined.item.length} services, ${countRequests(combined.item)} requests → ${COMBINED_COLLECTION_FILE}\n`
      : 'Combined collection not written: no service was created\n',
  );
}

async function main(): Promise<void> {
  fs.mkdirSync(COLLECTIONS_DIRECTORY, { recursive: true });

  const results = await Promise.all(listServices().map(generateCollection));
  const created = results.filter(
    (result) => result.status === CollectionStatusEnum.CREATED,
  );
  const combined = created.length ? buildCombinedCollection(created) : null;

  if (combined) {
    writeCollection(COMBINED_COLLECTION_FILE, combined);
  }

  printSummary(results, combined);

  if (results.some((result) => result.status === CollectionStatusEnum.FAILED)) {
    process.exitCode = 1;
  }
}

main();
