/**
 * Emotes sourced from octane.wtf/catalog (Octane Roblox revival, 2022 era).
 * 
 * Fetched 2026-10-23 via:
 *   GET https://octane.wtf/apisite/catalog/v1/search/items?subcategory=61&includeNotForSale=true&limit=100
 *   GET https://octane.wtf/apisite/develop/v1/assets?assetIds=...
 * 
 * subcategory 61 = EmoteAnimation (Roblox assetTypeId for emotes)
 * _total = 39 emotes at time of fetch.
 * 
 * To refresh: node scripts/fetch-octane-emotes.mjs
 * Raw JSON: src/data/octane-emotes.json
 */

export interface EmoteDef {
  id: number;        // Octane catalog asset ID (also assetId)
  name: string;
  description: string;
  creator: { type: string; targetId: number };
  created: string;   // ISO timestamp
}

export const EMOTE_IDS: number[] = [
  330795,
  275906,
  202845,
  160107,
  147873,
  145595,
  139727,
  137056,
  80818,
  72751,
  72747,
  70758,
  46867,
  46832,
  42016,
  41949,
  31112,
  7440,
  7438,
  7391,
  4197,
  3873,
  3616,
  3615,
  3614,
  3613,
  3612,
  3611,
  3610,
  3609,
  3608,
  3607,
  3606,
  3605,
  3604,
  3596,
  3587,
  3337,
  3336,
];

export const EMOTES: EmoteDef[] = [
  { id: 330795, name: "Swaying Sit", description: "", creator: { type: "User", targetId: 1 }, created: "2026-10-22T14:30:43.734123Z" },
  { id: 275906, name: "Raiden Fighting Armstrong [OG]", description: "Raiden Fighting Armstrong Emote\n\n🌅 Join Daylight UGC!\n\n⭐ FAVORITE for CHEAPER\nJoin Daylight UGC for more emotes", creator: { type: "User", targetId: 1 }, created: "2026-10-19T16:42:19.811897Z" },
  { id: 202845, name: "Jeyke Funk Setalcix", description: "That Super Funk dance Jeyke did", creator: { type: "User", targetId: 1 }, created: "2026-10-15T10:51:54.954986Z" },
  { id: 160107, name: "Curtsy", description: "How do you do?", creator: { type: "User", targetId: 1 }, created: "2026-10-14T00:41:54.382543Z" },
  { id: 147873, name: "NLE CHOPPA", description: "\n\n", creator: { type: "User", targetId: 1 }, created: "2026-10-13T10:54:08.085355Z" },
  { id: 145595, name: "Just be competent", description: "sway away", creator: { type: "User", targetId: 1 }, created: "2026-10-12T19:42:48.643618Z" },
  { id: 139727, name: "Random Moves", description: "Dance with us", creator: { type: "User", targetId: 1 }, created: "2026-10-11T21:08:41.253723Z" },
  { id: 137056, name: "Distraction Dance", description: "Distraction Dance", creator: { type: "User", targetId: 1 }, created: "2026-10-11T19:02:58.630113Z" },
  { id: 80818, name: "healing f5ve i choose you", description: "", creator: { type: "User", targetId: 1 }, created: "2026-10-05T00:40:12.175633Z" },
  { id: 72751, name: "Old Town Road Dance - Lil Nas X (LNX)", description: "There's a new sheriff in town.", creator: { type: "User", targetId: 1 }, created: "2026-10-04T03:11:21.416129Z" },
  { id: 72747, name: "Country Line Dance - Lil Nas X (LNX)", description: "Our kind of hoedown.", creator: { type: "User", targetId: 1 }, created: "2026-10-04T03:10:00.997546Z" },
  { id: 70758, name: "Say so", description: "", creator: { type: "User", targetId: 1 }, created: "2026-10-03T18:09:14.109923Z" },
  { id: 46867, name: "Lady Gaga - Rain On Me", description: "", creator: { type: "User", targetId: 1 }, created: "2026-09-29T19:22:06.62618Z" },
  { id: 46832, name: "Garry's Dance", description: "garrys mod dance yeah yeah", creator: { type: "User", targetId: 1 }, created: "2026-09-29T19:16:44.282776Z" },
  { id: 42016, name: "Cat Walk / Model Walk", description: "ts emote pmo bro\n", creator: { type: "User", targetId: 1 }, created: "2026-09-30T05:21:01.939605Z" },
  { id: 41949, name: "I see Kareem Groove", description: ".", creator: { type: "User", targetId: 1 }, created: "2026-09-30T04:30:50.396968Z" },
  { id: 31112, name: "Top Rock", description: "Rock however you want, but these moves will take you to the top.", creator: { type: "User", targetId: 1 }, created: "2026-09-28T09:34:45.68857Z" },
  { id: 7440, name: "Applaud", description: "Bring it in for the GOAT.", creator: { type: "User", targetId: 1 }, created: "2026-09-26T04:33:15.301402Z" },
  { id: 7438, name: "Tilt", description: "A 15 degree tilt, to be exact.", creator: { type: "User", targetId: 1 }, created: "2026-09-26T04:32:07.331082Z" },
  { id: 7391, name: "Fashionable", description: "Pose! Pose! Find the camera! Flawless!", creator: { type: "User", targetId: 1 }, created: "2026-09-26T04:23:25.749926Z" },
  { id: 4197, name: "V Pose - Tommy Hilfiger", description: "The Everything Emote!", creator: { type: "User", targetId: 1 }, created: "2026-09-25T18:48:21.238725Z" },
  { id: 3873, name: "Friendly Sneaking (Steven)", description: "perform the iconic MC friendly ritual...\n", creator: { type: "User", targetId: 1 }, created: "2026-09-25T15:57:28.150334Z" },
  { id: 3616, name: "Scuba Nick Wilde", description: "Scuuubaaaaa.\n\n\n", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:15:32.092503Z" },
  { id: 3615, name: "Dougie", description: "Everybody Loves Me\n\n", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:15:20.043978Z" },
  { id: 3614, name: "Nervy Dance", description: "", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:14:01.118222Z" },
  { id: 3613, name: "Billy Bounce", description: "", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:13:21.621751Z" },
  { id: 3612, name: "Kawaii Dance", description: "Legendary Kawaii Dance\n", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:12:39.689295Z" },
  { id: 3611, name: "Rampage Dance 🔥", description: "", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:12:17.777136Z" },
  { id: 3610, name: "how did he hit every beat", description: "Seriously How\n", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:11:09.063481Z" },
  { id: 3609, name: "Jamal Brazil Groove", description: "Jamal's Little Step", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:08:28.147251Z" },
  { id: 3608, name: "Money Hop Switch", description: " Seamless loop, optimized keyframes, no scale tracks. Looks great across all avatar heights.", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:07:48.038524Z" },
  { id: 3607, name: "It's Gangnam Style!", description: "The style of the community!", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:04:15.577573Z" },
  { id: 3606, name: "I got that feeling", description: "iiiiiiii GOT THAT FEEELIN!! IIII GOT THAT FEELIN\nAYEEEEE", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:04:04.751777Z" },
  { id: 3605, name: "Chinese Dance: Da Koto Nai", description: "", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:03:38.698019Z" },
  { id: 3604, name: "WISH NLE", description: "", creator: { type: "User", targetId: 1 }, created: "2026-09-25T03:01:47.543Z" },
  { id: 3596, name: "Beautiful Day Dance", description: "HELLO!\n", creator: { type: "User", targetId: 1 }, created: "2026-09-25T01:56:13.948931Z" },
  { id: 3587, name: "Moonwalk", description: "HEEEEE HEEEEEEE 🕺\n\n", creator: { type: "User", targetId: 1 }, created: "2026-09-25T01:42:15.572743Z" },
  { id: 3337, name: "test", description: "test", creator: { type: "User", targetId: 1 }, created: "2026-09-24T23:00:52.927422Z" },
  { id: 3336, name: "test", description: "test", creator: { type: "User", targetId: 1 }, created: "2026-09-24T22:59:26.643468Z" },
];

export function getEmote(id: number): EmoteDef | undefined {
  return EMOTES.find(e => e.id === id);
}

// Convenience: rbxassetid:// URL for use in Roblox/FFlag emulation, or Octane asset delivery
export const emoteAssetUrl = (id: number) => `https://octane.wtf/catalog/${id}/item`;
export const emoteThumbnailUrl = (id: number) => `https://octane.wtf/apisite/thumbnails/v1/assets?assetIds=${id}&size=420x420&format=Png`;
