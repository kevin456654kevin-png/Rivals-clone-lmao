# Octane.wtf Emote Catalog — Fetch Report

**Fetched:** 2026-10-23 23:08 UTC
**Source:** https://octane.wtf/catalog (Octane Roblox revival, 2022-era, formerly Aisaka/Caelus)
**Total emotes:** 39

## How it was fetched

Octane's HTML catalog at `https://octane.wtf/catalog` is protected by Cloudflare Turnstile and redirects to `/auth/login` when fetched without a browser. However its internal API under `https://octane.wtf/apisite` is public and used by the official site and the community extension `wozers0/kerosene`.

Discovered endpoints (via reading `wozers0/kerosene` source):

1. **Catalog search (public GET, no auth):**
   ```
   GET https://octane.wtf/apisite/catalog/v1/search/items?subcategory=61&includeNotForSale=true&limit=100
   ```
   - `subcategory` = Roblox `assetTypeId` (61 = EmoteAnimation)
   - `includeNotForSale=true` includes off-sale / limited items
   - Returns `{_total, data:[{itemType:"Asset", id}], nextPageCursor}`
   - First page with `limit=100` returns all 39 emotes in one call (`_total:39`, `nextPageCursor:null`)

2. **Asset details (public GET, no auth):**
   ```
   GET https://octane.wtf/apisite/develop/v1/assets?assetIds=3609,3610,3611...
   ```
   - Returns `{data:[{id, assetId, type:"EmoteAnimation", typeId:61, name, description, creator, created, updated}]}`
   - Bulk fetch in chunks of 10 to avoid rate-limit (50 req/min, 403 nginx throttle)

Alternative POST endpoint `POST /catalog/v1/catalog/items/details` requires CSRF + session cookie and is not needed — the `develop` API gives the same data via GET.

Also used:
- `GET /apisite/thumbnails/v1/assets?assetIds=...&size=420x420&format=Png` for thumbnails (returns `tcdn.octane.wtf` URLs)

## Reproduce

```bash
node scripts/fetch-octane-emotes.mjs
# writes src/data/octane-emotes.json + prints table
```

Script is committed at `scripts/fetch-octane-emotes.mjs`.

## All 39 Emote IDs (catalog order, newest first)

| # | ID | Name | Created |
|---|------|------|---------|
| 1 | 330795 | Swaying Sit | 2026-10-22 |
| 2 | 275906 | Raiden Fighting Armstrong [OG] | 2026-10-19 |
| 3 | 202845 | Jeyke Funk Setalcix | 2026-10-15 |
| 4 | 160107 | Curtsy | 2026-10-14 |
| 5 | 147873 | NLE CHOPPA | 2026-10-13 |
| 6 | 145595 | Just be competent | 2026-10-12 |
| 7 | 139727 | Random Moves | 2026-10-11 |
| 8 | 137056 | Distraction Dance | 2026-10-11 |
| 9 | 80818 | healing f5ve i choose you | 2026-10-05 |
| 10 | 72751 | Old Town Road Dance - Lil Nas X (LNX) | 2026-10-04 |
| 11 | 72747 | Country Line Dance - Lil Nas X (LNX) | 2026-10-04 |
| 12 | 70758 | Say so | 2026-10-03 |
| 13 | 46867 | Lady Gaga - Rain On Me | 2026-09-29 |
| 14 | 46832 | Garry's Dance | 2026-09-29 |
| 15 | 42016 | Cat Walk / Model Walk | 2026-09-30 |
| 16 | 41949 | I see Kareem Groove | 2026-09-30 |
| 17 | 31112 | Top Rock | 2026-09-28 |
| 18 | 7440 | Applaud | 2026-09-26 |
| 19 | 7438 | Tilt | 2026-09-26 |
| 20 | 7391 | Fashionable | 2026-09-26 |
| 21 | 4197 | V Pose - Tommy Hilfiger | 2026-09-25 |
| 22 | 3873 | Friendly Sneaking (Steven) | 2026-09-25 |
| 23 | 3616 | Scuba Nick Wilde | 2026-09-25 |
| 24 | 3615 | Dougie | 2026-09-25 |
| 25 | 3614 | Nervy Dance | 2026-09-25 |
| 26 | 3613 | Billy Bounce | 2026-09-25 |
| 27 | 3612 | Kawaii Dance | 2026-09-25 |
| 28 | 3611 | Rampage Dance 🔥 | 2026-09-25 |
| 29 | 3610 | how did he hit every beat | 2026-09-25 |
| 30 | 3609 | Jamal Brazil Groove | 2026-09-25 |
| 31 | 3608 | Money Hop Switch | 2026-09-25 |
| 32 | 3607 | It's Gangnam Style! | 2026-09-25 |
| 33 | 3606 | I got that feeling | 2026-09-25 |
| 34 | 3605 | Chinese Dance: Da Koto Nai | 2026-09-25 |
| 35 | 3604 | WISH NLE | 2026-09-25 |
| 36 | 3596 | Beautiful Day Dance | 2026-09-25 |
| 37 | 3587 | Moonwalk | 2026-09-25 |
| 38 | 3337 | test | 2026-09-24 |
| 39 | 3336 | test | 2026-09-24 |

### Plain ID list (for copy-paste / code)

```
330795, 275906, 202845, 160107, 147873, 145595, 139727, 137056, 80818, 72751, 72747, 70758, 46867, 46832, 42016, 41949, 31112, 7440, 7438, 7391, 4197, 3873, 3616, 3615, 3614, 3613, 3612, 3611, 3610, 3609, 3608, 3607, 3606, 3605, 3604, 3596, 3587, 3337, 3336
```

Also saved as:
- `octane-emote-ids.txt` (one per line)
- `src/data/octane-emotes.json` (full JSON with names, descriptions, timestamps, URLs)
- `src/data/emotes.ts` (typed TS module for the Rivals clone)

## Notes

- IDs are Octane's internal catalog IDs (incremental, not Roblox asset IDs). They map to `https://octane.wtf/catalog/{id}/item` and have thumbnails at `tcdn.octane.wtf`.
- All 39 are `typeId:61` / `type:"EmoteAnimation"` and `creator: User@1` (Octane system user).
- Catalog order appears to be newest first (by `created`).
- Rate-limit handling: Octane returns bare nginx 403 without JSON when throttled; retry with backoff as `kerosene` does (3s/8s/16s).

## Files in repo

- `scripts/fetch-octane-emotes.mjs` — fetcher
- `src/data/emotes.ts` — TS module (`EMOTE_IDS`, `EMOTES`, helpers)
- `src/data/octane-emotes.json` — raw enriched JSON
- `octane-emote-ids.txt` — plain list
- `OCTANE_EMOTES.md` — this report
