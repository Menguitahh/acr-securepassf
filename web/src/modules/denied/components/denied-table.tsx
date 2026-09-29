import { formatInTz, TABLE_DATE_TIME } from "@/common/lib/datetime";
import type { DeniedLogRow } from "@/modules/denied/types";

interface Props {
  rows: DeniedLogRow[];
  timeZone: string;
}

const HEADERS = ["Hora", "Persona", "Documento", "Lote", "Tipo", "Sentido"];

export function DeniedTable({ rows, timeZone }: Props) {
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
            <tr key={row.id} className="h-12">
              <td className="px-4 whitespace-nowrap tabular-nums">
                {formatInTz(row.capturedAt, timeZone, TABLE_DATE_TIME)}
              </td>
              <td className="px-4">{row.subjectName}</td>
              <td className="px-4 tabular-nums">{row.subjectDocument}</td>
              <td className="px-4">{row.lotCode}</td>
              <td className="px-4">{row.subjectType}</td>
              <td className="px-4">{row.direction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
