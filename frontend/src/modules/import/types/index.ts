// CHOS-406: bulk athlete import types (mirror the backend ImportReport schema).

export interface RowError {
  field: string | null;
  code: string | null;
  message: string;
}

export interface RowResult {
  row: number;
  ok: boolean;
  enroll_id: number | null;
  errors: RowError[];
}

export interface ImportReport {
  committed: boolean;
  total: number;
  valid: number;
  invalid: number;
  created: number;
  rows: RowResult[];
}

export interface ImportContext {
  eventId: number;
  organizationId?: number;
  sportId: number;
  categoryId?: number;
  force?: boolean;
}
