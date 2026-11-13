export interface DeleteUnusedDataInput {
  readonly kind: 'dataset' | 'source';
  readonly id: string;
}
