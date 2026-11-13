/** Display only. Every command independently authorizes against the target website. */
export interface DataSourceCapabilities {
  readonly canCreateSource: boolean;
  readonly canUpdateSource: boolean;
  readonly canDeleteSource: boolean;
  readonly canTestSource: boolean;
  readonly canCreateDataset: boolean;
  readonly canUpdateDataset: boolean;
  readonly canDeleteDataset: boolean;
  readonly canMapDataset: boolean;
}
