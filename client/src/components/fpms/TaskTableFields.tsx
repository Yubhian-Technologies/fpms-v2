import { useState } from "react";
import { Paperclip, Plus, Trash2, X } from "lucide-react";
import { resolveEvidenceLink } from "@/lib/utils";
import { normalizeTableColumns, type TableColumn, type TaskTableRow } from "@/types/formBuilder";

// A row while faculty edit it: a document is a File until it is uploaded on submit
export interface EditableTableRow {
  cells: string[];
  docs: (string | File)[];
  docHashes: string[];
}

/** Cell errors keyed `${row}:${column}` (e.g. duplicate-limit messages from the server) */
export type TableCellErrors = Record<string, string>;

const emptyRow = (columns: TableColumn[]): EditableTableRow => ({
  cells: columns.map(() => ""),
  docs: columns.map(() => ""),
  docHashes: columns.map(() => ""),
});

const rowIsFilled = (row: EditableTableRow) =>
  row.cells.some((c) => c.trim()) || row.docs.some((d) => (d instanceof File ? true : Boolean(d)));

// Builds the editable grid: saved rows first, padded with empty rows up to `minRows`
export const buildTableRows = (
  columns: TableColumn[],
  saved: TaskTableRow[] | undefined,
  minRows: number,
): EditableTableRow[] => {
  const rows: EditableTableRow[] = (saved || []).map((row) => ({
    cells: columns.map((_, i) => row?.cells?.[i] ?? ""),
    docs: columns.map((_, i) => row?.docs?.[i] ?? ""),
    docHashes: columns.map((_, i) => row?.docHashes?.[i] ?? ""),
  }));
  while (rows.length < Math.max(minRows, 1)) rows.push(emptyRow(columns));
  return rows;
};

// Rows to send to the server: blank rows dropped. Call after files are uploaded.
export const toTableData = (rows: EditableTableRow[]): TaskTableRow[] =>
  rows.filter(rowIsFilled).map((row) => ({
    cells: row.cells,
    docs: row.docs.map((d) => (typeof d === "string" ? d : "")),
    docHashes: row.docHashes,
  }));

export const tableHasFilledRow = (rows: EditableTableRow[]) => rows.some(rowIsFilled);

// Table uploads: PDF only, under 10 MB
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const docFileError = (file: File) => {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF files are allowed.";
  if (file.size >= MAX_DOC_BYTES) return "PDF must be smaller than 10 MB.";
  return null;
};

// Fingerprint used by the server's duplicate-proof limit
const fingerprintFile = async (file: File) => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
};

function DocumentLink({ doc }: { doc: string }) {
  const href = resolveEvidenceLink(doc);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-700 hover:underline">
      View document
    </a>
  ) : null;
}

interface TaskTableInputProps {
  columns: TableColumn[];
  rows: EditableTableRow[];
  onChange?: (rows: EditableTableRow[]) => void;
  readOnly?: boolean;
  errors?: TableCellErrors;
  /** Fired when a limited (duplicate-checked) cell loses focus or gets a new proof */
  onLimitedCellCommit?: (rows: EditableTableRow[]) => void;
}

// Faculty fill-in table (S. No. column is automatic)
export function TaskTableInput({ columns, rows, onChange, readOnly, errors, onLimitedCellCommit }: TaskTableInputProps) {
  const [fileErrors, setFileErrors] = useState<TableCellErrors>({});
  const setFileError = (key: string, message: string | null) =>
    setFileErrors((prev) => {
      const next = { ...prev };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });

  const updateRow = (r: number, patch: (row: EditableTableRow) => EditableTableRow) => {
    const next = rows.map((row, ri) => (ri === r ? patch(row) : row));
    onChange?.(next);
    return next;
  };

  const setCell = (r: number, c: number, value: string) =>
    updateRow(r, (row) => ({ ...row, cells: row.cells.map((v, ci) => (ci === c ? value : v)) }));

  const setDoc = (r: number, c: number, doc: string | File, hash: string) =>
    updateRow(r, (row) => ({
      ...row,
      docs: row.docs.map((v, ci) => (ci === c ? doc : v)),
      docHashes: row.docHashes.map((v, ci) => (ci === c ? hash : v)),
    }));

  const commitDoc = async (r: number, c: number, doc: string | File) => {
    const hash = doc instanceof File ? await fingerprintFile(doc) : "";
    const next = setDoc(r, c, doc, hash);
    if (columns[c].maxUses) onLimitedCellCommit?.(next);
  };

  const visibleRows = readOnly ? rows.filter(rowIsFilled) : rows;
  // Text columns first, document (upload) columns at the end of the table
  const order = columns
    .map((_, i) => i)
    .sort((a, b) => Number(columns[a].document !== "none") - Number(columns[b].document !== "none"));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-slate-300">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left align-bottom">
              <th className="w-16 whitespace-nowrap border-b border-r border-slate-300 px-3 py-2.5 font-semibold">S. No.</th>
              {order.map((i) => {
                const col = columns[i];
                return (
                  <th
                    key={i}
                    className={`border-b border-r border-slate-300 px-3 py-2.5 font-semibold last:border-r-0 ${col.document !== "none" ? "min-w-[200px]" : "min-w-[160px]"}`}
                  >
                    {col.label}
                    {col.document === "required" && <span className="ml-0.5 text-red-600">*</span>}
                    {col.document === "optional" && <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>}
                  </th>
                );
              })}
              {!readOnly && <th className="w-10 border-b border-slate-300" />}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-3 text-center text-muted-foreground">
                  No entries
                </td>
              </tr>
            ) : (
              visibleRows.map((row, r) => (
                <tr key={r} className="align-top [&:not(:last-child)>td]:border-b [&>td]:border-slate-300">
                  <td className="border-r px-3 py-2.5 tabular-nums">{r + 1}</td>
                  {order.map((c) => {
                    const column = columns[c];
                    const error = fileErrors[`${r}:${c}`] || errors?.[`${r}:${c}`];
                    const doc = row.docs[c];
                    const isDocColumn = column.document !== "none";
                    if (readOnly) {
                      return (
                        <td key={c} className="space-y-1 border-r px-3 py-2.5 last:border-r-0">
                          {row.cells[c] && <div className="whitespace-pre-wrap">{row.cells[c]}</div>}
                          {typeof doc === "string" && doc && <DocumentLink doc={doc} />}
                          {!row.cells[c] && !doc && <div>—</div>}
                        </td>
                      );
                    }
                    return (
                      <td key={c} className="space-y-1.5 border-r p-1.5">
                        {!isDocColumn ? (
                          <input
                            value={row.cells[c]}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            onBlur={() => column.maxUses && onLimitedCellCommit?.(rows)}
                            placeholder={column.label}
                            className={`w-full rounded border bg-white px-2 py-1.5 outline-none placeholder:text-slate-300 focus:ring-2 ${
                              error ? "border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
                            }`}
                          />
                        ) : doc ? (
                          <div className={`flex items-center gap-2 rounded border bg-white px-2 py-1.5 text-xs ${error ? "border-red-400" : "border-slate-200"}`}>
                            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {doc instanceof File ? <span className="truncate">{doc.name}</span> : <DocumentLink doc={doc} />}
                            <button
                              type="button"
                              title="Remove document"
                              onClick={() => commitDoc(r, c, "")}
                              className="ml-auto rounded p-0.5 text-red-600 hover:bg-red-50"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="block w-full py-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-indigo-700"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const message = docFileError(file);
                              setFileError(`${r}:${c}`, message);
                              if (message) {
                                e.target.value = "";
                                return;
                              }
                              commitDoc(r, c, file);
                            }}
                          />
                        )}
                        {error && <p className="px-2 text-xs font-medium text-red-600">{error}</p>}
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        title="Remove row"
                        disabled={rows.length <= 1}
                        onClick={() => {
                          setFileErrors({});
                          onChange?.(rows.filter((_, ri) => ri !== r));
                        }}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange?.([...rows, emptyRow(columns)])}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-indigo-300 bg-indigo-50/50 py-2 text-sm font-medium text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
        >
          <Plus className="h-4 w-4" /> Add row
        </button>
      )}
    </div>
  );
}

// Read-only table for reviewer / appeal screens
export function SubmissionTableView({ submission }: { submission: any }) {
  const columns = normalizeTableColumns(submission?.tableColumns);
  if (!columns.length) return null;
  return <TaskTableInput columns={columns} rows={buildTableRows(columns, submission?.tableData || [], 0)} readOnly />;
}
