import { CollectionStatusEnum } from './postman.enum';

interface PostmanVariable {
  key: string;
  value: string;
  type: string;
}

interface PostmanItem {
  name?: string;
  description?: unknown;
  item?: PostmanItem[];
}

interface PostmanCollection {
  info: {
    name: string;
    schema: string;
    description?: unknown;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

interface CollectionResult {
  service: string;
  status: CollectionStatusEnum;
  detail: string;
  collection?: PostmanCollection;
}

export type {
  CollectionResult,
  PostmanCollection,
  PostmanItem,
  PostmanVariable,
};
