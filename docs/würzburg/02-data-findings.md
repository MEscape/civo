# Data findings

## Evidence established

- All 185 city catalog entries now have captured JSON-LD metadata. Actual keywords, license URIs and download formats vary by source.
- PEGELONLINE station objects deliver uuid, shortname/longname, latitude/longitude, water and timeseries arrays. Series carry unit/equidistance; measurements carry timestamp/value. Preserve station and series identifiers rather than mapping them to a hard-coded civic category.
- Würzburg water-level values are in cm relative to gauge zero. Other Main station series include different units. Compare only matching units.
- The one-day measurement fixture proves bounded timestamped data. Longer history, source-specific quotas and window aggregation remain Not Verified.
- NINA's verified empty response needs an honest empty state; it cannot justify invented warning fields or alerts.
- Candidate catalogs and official sites differ in protocol, robots rules and returned formats. HTTP 200 does not establish JSON or permission to redistribute.

## Design consequences

Use dynamic source/config categories and allow ungrouped records. Retain unit, source and capture time. Keep missing measurements missing. Show a clearly dated snapshot until actual refresh/caching failure behavior is implemented and tested. Public pages now use real source snapshots and factual service links. Generated booking transactions remain internal; the public path leads to official municipal appointments.

## Not established

Captured city records cover all 13 district polygons, all 177 cycle parking places, all 96 toilet records, all 12 climate-tree locations, 2,600 waste dates, cycle counters and parking statuses. A 100-record tree sample and historical weather remain internal contract fixtures. Parking has status but no free-space counts. Weather Ludwigkai stops on 2026-02-02 and is excluded from current public pages. District population values in 2025 require unit/quality review and are not displayed. Full tree ingestion, guaranteed history, OParl/GTFS/GBFS/OGC and district statistical joins remain incomplete. A bounded server-side refresh cycle has updated existing source configurations successfully; an immediate repeat performed no requests within budget. A monitored deployment worker is still an operational acceptance requirement.

Daily cycle counts supply a calendar date, not a measurement time. They carry resolution `P1D`; charts and tables format their calendar date independently of the viewer's time zone. PEGELONLINE measurements retain actual UTC instants and gain clock precision as the visible range narrows. Complete short series bound their initial window to available records so the first zoom changes the visible range.
