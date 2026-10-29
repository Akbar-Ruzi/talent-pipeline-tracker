// Loads every academy candidate (GET /records only), so the list can search,
// filter and page academy and local candidates together in the browser.

import { getRecords } from "@/lib/api/records";
import { ACADEMY_FETCH_LIMIT, ACADEMY_MAX_PAGES } from "./constants";
import type { Candidate } from "@/types/candidate";

export type AcademyRecords = {
  records: Candidate[]; // in the API's order
  // true when the page cap stopped the loading early: counts then cover only
  // the loaded candidates, and the list should say so
  truncated: boolean;
};

export async function fetchAllAcademyRecords(): Promise<AcademyRecords> {
  // Keyed by ID: if a candidate is added while the pages load, rows shift
  // and one can come back on two pages
  const byId = new Map<string, Candidate>();
  let total = 0;

  for (let page = 1; page <= ACADEMY_MAX_PAGES; page++) {
    const response = await getRecords({ page, limit: ACADEMY_FETCH_LIMIT });
    total = response.total;
    response.data.forEach((record) => byId.set(record.id, record));
    // An empty page means candidates were removed meanwhile: nothing more to load
    if (response.data.length === 0 || byId.size >= total) break;
  }

  return { records: [...byId.values()], truncated: byId.size < total };
}
