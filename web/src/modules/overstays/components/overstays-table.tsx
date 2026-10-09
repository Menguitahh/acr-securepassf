"use client";

import { useTable } from "@tanstack/react-table";
import { useMemo } from "react";

import { overstayTableOptions } from "@/modules/overstays/lib";
import type { OverstayRow } from "@/modules/overstays/types";

interface Props {
  rows: OverstayRow[];
  timeZone: string;
}

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

export function OverstaysTable({ rows, timeZone }: Props) {
  const options = useMemo(() => overstayTableOptions(rows, timeZone), [rows, timeZone]);
  const table = useTable(options);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-text-muted">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th key={header.id} scope="col" aria-sort={sorted ? ARIA_SORT[sorted] : "none"} className="font-normal">
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex min-h-12 w-full items-center gap-2 px-4 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-text-primary"
                    >
                      <table.FlexRender header={header} />
                      <span aria-hidden="true">{sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : ""}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-border">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.original.stayId} className="h-12">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-4 tabular-nums">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
