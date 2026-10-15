/**
 * A reference to a key stakeholder from another module. The name is a snapshot
 * taken at the time of reference, so a record keeps reading correctly after the
 * stakeholder is renamed or removed.
 */
export interface StakeholderRef {
  id: string;
  name: string;
}
