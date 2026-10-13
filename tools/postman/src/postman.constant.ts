import type { Options } from 'openapi-to-postmanv2';

const APPS_DIRECTORY = 'apps';
const OUTPUT_DIRECTORY = 'dist/postman';
const COLLECTIONS_DIRECTORY = `${OUTPUT_DIRECTORY}/collections`;
const COMBINED_COLLECTION_NAME = 'masr3';
const COMBINED_COLLECTION_FILE = `${OUTPUT_DIRECTORY}/${COMBINED_COLLECTION_NAME}.postman_collection.json`;
const POSTMAN_COLLECTION_SCHEMA =
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
const OPENAPI_JSON_PATH = '/api/docs-json';
const SWAGGER_SETUP_MARKER = 'SwaggerModule.setup(';
const FETCH_TIMEOUT_MILLISECONDS = 5000;
const CONVERTER_BASE_URL_VARIABLE = 'baseUrl';
const BASE_URL_VARIABLE_SUFFIX = 'base_url';

// The converter's own variable names, renamed to snake_case. baseUrl is
// renamed per service instead (auth_service_base_url).
const CONVERTER_VARIABLE_RENAMES: Record<string, string> = {
  bearerToken: 'bearer_token',
  basicAuthUsername: 'basic_auth_username',
  basicAuthPassword: 'basic_auth_password',
};

const CONVERTER_OPTIONS: Options = {
  folderStrategy: 'Tags',
  parametersResolution: 'Example',
};

export {
  APPS_DIRECTORY,
  OUTPUT_DIRECTORY,
  COLLECTIONS_DIRECTORY,
  COMBINED_COLLECTION_NAME,
  COMBINED_COLLECTION_FILE,
  POSTMAN_COLLECTION_SCHEMA,
  OPENAPI_JSON_PATH,
  SWAGGER_SETUP_MARKER,
  FETCH_TIMEOUT_MILLISECONDS,
  CONVERTER_BASE_URL_VARIABLE,
  BASE_URL_VARIABLE_SUFFIX,
  CONVERTER_VARIABLE_RENAMES,
  CONVERTER_OPTIONS,
};
