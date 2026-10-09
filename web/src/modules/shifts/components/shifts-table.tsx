import { formatInTz, TABLE_DATE_TIME } from "@/common/lib/datetime";
import { formatShiftEnd } from "@/modules/shifts/lib";
import type { ShiftRow } from "@/modules/shifts/types";

interface Props {
  rows: ShiftRow[];
  timeZone: string;
}

const HEADERS = ["Garita", "Guardia", "Inicio", "Fin", "Accesos", "Nota de entrega"];

export function ShiftsTable({ rows, timeZone }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-text-muted">
          <tr className="h-12">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-4 font-normal">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="h-12 align-top">
              <td className="px-4 py-3">{row.gateName}</td>
              <td className="px-4 py-3">{row.guardName}</td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                {formatInTz(row.startedAt, timeZone, TABLE_DATE_TIME)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                {formatShiftEnd(row.endedAt, timeZone)}
              </td>
              <td className="px-4 py-3 tabular-nums">{row.accessCount}</td>
              <td className="max-w-md px-4 py-3 whitespace-pre-line">
                {row.handoverNotes || <span className="text-text-muted">Sin nota</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
