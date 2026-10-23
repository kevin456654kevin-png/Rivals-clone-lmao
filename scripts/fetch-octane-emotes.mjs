/**
 * fetch-octane-emotes.mjs
 * 
 * Fetches all emote asset IDs from octane.wtf/catalog.
 * 
 * Octane is a 2022-era Roblox revival (octane.wtf, formerly Aisaka/Caelus).
 * Its catalog mirrors Roblox's catalog API but under /apisite.
 * 
 * Discovered endpoints (via wozers0/kerosene extension):
 *   - Search: GET https://octane.wtf/apisite/catalog/v1/search/items?subcategory=61&includeNotForSale=true&limit=100
 *     where subcategory = assetTypeId (61 = EmoteAnimation)
 *     Returns: { _total, data: [{itemType:"Asset", id}], nextPageCursor }
 *   - Details: GET https://octane.wtf/apisite/develop/v1/assets?assetIds=ID1,ID2,...
 *     Returns: { data: [{id, assetId, typeId:61, name, description, creator, created, ...}] }
 * 
 * The catalog search is public (no auth, bypasses Cloudflare Turnstile on /apisite),
 * while the HTML catalog at /catalog is protected by Turnstile and redirects to /auth/login.
 * The POST details endpoint at /catalog/v1/catalog/items/details requires CSRF and is not
 * usable without a session — the develop API is the public GET alternative.
 * 
 * Usage: node scripts/fetch-octane-emotes.mjs
 * Output: prints JSON and writes to src/data/octane-emotes.json
 */

const SITE = "https://octane.wtf";
const API = `${SITE}/apisite`;

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}: ${await res.text().slice(0,500)}`);
  return res.json();
}

async function fetchAllEmoteIds() {
  // subcategory 61 = EmoteAnimation, includeNotForSale=true gets offsale + on-sale
  const url = `${API}/catalog/v1/search/items?subcategory=61&includeNotForSale=true&limit=100`;
  const data = await fetchJson(url);
  const ids = (data.data || []).filter(d => d.itemType === "Asset").map(d => d.id);
  // Handle pagination if _total > ids.length (cursor is index as string)
  let allIds = [...ids];
  let cursor = data.nextPageCursor;
  while (cursor) {
    const page = await fetchJson(`${API}/catalog/v1/search/items?subcategory=61&includeNotForSale=true&limit=100&cursor=${encodeURIComponent(cursor)}`);
    const pageIds = (page.data || []).filter(d => d.itemType === "Asset").map(d => d.id);
    for (const id of pageIds) if (!allIds.includes(id)) allIds.push(id);
    cursor = page.nextPageCursor;
    if (!cursor) break;
  }
  // Deduplicate but preserve order, sort by catalog order (which is newest first)
  return { total: data._total ?? allIds.length, ids: allIds };
}

async function fetchDetails(ids) {
  const out = [];
  // batch in 10s to be gentle (Octane rate-limits at ~50 req/min)
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const data = await fetchJson(`${API}/develop/v1/assets?assetIds=${chunk.join(",")}`);
    out.push(...(data.data || []));
    // small delay to avoid 429
    if (i + 10 < ids.length) await new Promise(r => setTimeout(r, 150));
  }
  return out;
}

async function main() {
  console.log("Fetching Octane emote IDs from", `${API}/catalog/v1/search/items?subcategory=61`);
  const { total, ids } = await fetchAllEmoteIds();
  console.log(`Found ${ids.length} IDs (reported _total=${total}):`, ids);

  console.log("\nFetching details for each emote via /develop/v1/assets ...");
  const details = await fetchDetails(ids);
  // sort details to match catalog order
  const byId = new Map(details.map(d => [d.id, d]));
  const ordered = ids.map(id => byId.get(id)).filter(Boolean);

  console.log(`\nGot ${ordered.length} emote details:\n`);
  for (const d of ordered) {
    console.log(`  ${d.id.toString().padEnd(6)}  ${d.name}  —  "${d.description.replace(/\n/g,' ')}"`);
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: `${API}/catalog/v1/search/items?subcategory=61&includeNotForSale=true&limit=100`,
    detailsSource: `${API}/develop/v1/assets?assetIds=...`,
    count: ordered.length,
    ids,
    emotes: ordered.map(d => ({
      id: d.id,
      assetId: d.assetId,
      name: d.name,
      description: d.description,
      type: d.type,
      typeId: d.typeId,
      creator: d.creator,
      created: d.created,
      updated: d.updated,
      thumbnail: `https://tcdn.octane.wtf/${d.id}`, // placeholder, real via thumbnails API
    }))
  };

  // Write to file if fs available
  try {
    const fs = await import("fs");
    const path = new URL("../src/data/octane-emotes.json", import.meta.url);
    fs.mkdirSync(new URL("../src/data", import.meta.url), { recursive: true });
    fs.writeFileSync(path, JSON.stringify(payload, null, 2));
    console.log(`\nWrote ${payload.count} emotes to src/data/octane-emotes.json`);
  } catch {}

  // Also try writing to repo root for convenience
  try {
    const fs = await import("fs");
    fs.writeFileSync(new URL("../octane-emotes.json", import.meta.url), JSON.stringify(payload, null, 2));
  } catch {}
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("fetch-octane-emotes.mjs")) {
  main().catch(e => { console.error(e); process.exit(1); });
}
export { fetchAllEmoteIds, fetchDetails };
