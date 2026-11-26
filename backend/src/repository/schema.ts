/**
 * Sheet definitions. Column order is used when a sheet is first created; afterwards columns are
 * mapped by header name, so reordering columns by hand is harmless. Every cell is stored as text.
 */
export const TABLES = {
  Users: {
    id: 'user_id',
    columns: ['user_id', 'email', 'full_name', 'position', 'roles', 'is_active', 'created_at', 'updated_at', 'version'],
  },
  Certificates: {
    id: 'cert_id',
    columns: [
      'cert_id', 'code', 'cert_type', 'cert_number', 'date_issued', 'transmittal_number', 'transmittal_date', 'recipient_name', 'recipient_address',
      'project_name', 'project_location', 'developer_name', 'coverage', 'remarks', 'status',
      'documents_json', 'created_by', 'created_at', 'released_at', 'released_by', 'revoked_at', 'revoked_by',
      'revoke_reason', 'idempotency_key', 'updated_at', 'version',
    ],
  },
  Settings: { id: 'key', columns: ['key', 'value', 'updated_by', 'updated_at'] },
  AuditLog: { id: 'log_id', columns: ['log_id', 'at', 'actor_id', 'actor_email', 'action', 'entity_id', 'detail_json'] },
} as const;

export type TableName = keyof typeof TABLES;
export type ColumnOf<T extends TableName> = (typeof TABLES)[T]['columns'][number];
export type RowOf<T extends TableName> = Record<ColumnOf<T>, string>;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];
