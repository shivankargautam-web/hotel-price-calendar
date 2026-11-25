export type BrandId = "taj" | "oberoi" | "leela" | "itc";

export interface RoomType {
  id: string;
  name: string;
  /** Room codes used by live availability providers, keyed by provider id. */
  externalIds?: Record<string, string>;
}

export interface Hotel {
  id: string;
  name: string;
  brand: BrandId;
  city: string;
  state: string;
  website: string;
  roomTypes: RoomType[];
  /** Property codes used by live availability providers, keyed by provider id. */
  externalIds?: Record<string, string>;
}

export const BRANDS: Record<BrandId, string> = {
  taj: "Taj",
  oberoi: "The Oberoi",
  leela: "The Leela",
  itc: "ITC Hotels",
};

const TAJ_SITE = "https://www.tajhotels.com/";

function rooms(...names: string[]): RoomType[] {
  return names.map((name) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    name,
  }));
}

export const HOTELS: Hotel[] = [
  { id: "taj-mahal-palace-mumbai", name: "The Taj Mahal Palace", brand: "taj", city: "Mumbai", state: "Maharashtra", website: TAJ_SITE, roomTypes: rooms("Luxury Grande Room, City View", "Luxury Grande Room, Sea View", "Taj Club Room", "Luxury Suite") },
  { id: "taj-lands-end-mumbai", name: "Taj Lands End", brand: "taj", city: "Mumbai", state: "Maharashtra", website: TAJ_SITE, roomTypes: rooms("Superior Room, City View", "Deluxe Room, Sea View", "Taj Club Room") },
  { id: "taj-palace-new-delhi", name: "Taj Palace", brand: "taj", city: "New Delhi", state: "Delhi", website: TAJ_SITE, roomTypes: rooms("Superior Room", "Deluxe Room, Garden View", "Taj Club Room") },
  { id: "taj-mahal-new-delhi", name: "Taj Mahal, New Delhi", brand: "taj", city: "New Delhi", state: "Delhi", website: TAJ_SITE, roomTypes: rooms("Luxury Room", "Deluxe Room, Garden View", "Luxury Suite") },
  { id: "taj-west-end-bengaluru", name: "Taj West End", brand: "taj", city: "Bengaluru", state: "Karnataka", website: TAJ_SITE, roomTypes: rooms("Superior Room, Garden View", "Deluxe Room, Patio", "Heritage Suite") },
  { id: "taj-coromandel-chennai", name: "Taj Coromandel", brand: "taj", city: "Chennai", state: "Tamil Nadu", website: TAJ_SITE, roomTypes: rooms("Superior Room", "Deluxe Room", "Taj Club Room") },
  { id: "taj-falaknuma-palace-hyderabad", name: "Taj Falaknuma Palace", brand: "taj", city: "Hyderabad", state: "Telangana", website: TAJ_SITE, roomTypes: rooms("Palace Room", "Historical Suite", "Grand Royal Suite") },
  { id: "taj-lake-palace-udaipur", name: "Taj Lake Palace", brand: "taj", city: "Udaipur", state: "Rajasthan", website: TAJ_SITE, roomTypes: rooms("Palace Room, Lily Pond View", "Luxury Room, Lake View", "Grand Royal Suite") },
  { id: "rambagh-palace-jaipur", name: "Rambagh Palace", brand: "taj", city: "Jaipur", state: "Rajasthan", website: TAJ_SITE, roomTypes: rooms("Palace Room", "Luxury Room", "Historical Suite") },
  { id: "taj-fort-aguada-goa", name: "Taj Fort Aguada Resort & Spa", brand: "taj", city: "Goa", state: "Goa", website: TAJ_SITE, roomTypes: rooms("Superior Room, Garden View", "Deluxe Room, Sea View", "Premium Villa, Sea View") },
  { id: "taj-bengal-kolkata", name: "Taj Bengal", brand: "taj", city: "Kolkata", state: "West Bengal", website: TAJ_SITE, roomTypes: rooms("Superior Room", "Deluxe Room, Pool View", "Taj Club Room") },
  { id: "taj-malabar-kochi", name: "Taj Malabar Resort & Spa", brand: "taj", city: "Kochi", state: "Kerala", website: TAJ_SITE, roomTypes: rooms("Superior Room, Harbour View", "Heritage Room, Sea View", "Malabar Suite") },
  { id: "taj-mahal-lucknow", name: "Taj Mahal, Lucknow", brand: "taj", city: "Lucknow", state: "Uttar Pradesh", website: TAJ_SITE, roomTypes: rooms("Superior Room", "Deluxe Room", "Luxury Suite") },
  { id: "taj-ganges-varanasi", name: "Taj Ganges", brand: "taj", city: "Varanasi", state: "Uttar Pradesh", website: TAJ_SITE, roomTypes: rooms("Superior Room", "Deluxe Room, Garden View", "Luxury Suite") },
  { id: "taj-chia-kutir-darjeeling", name: "Taj Chia Kutir Resort & Spa", brand: "taj", city: "Darjeeling", state: "West Bengal", website: TAJ_SITE, roomTypes: rooms("Deluxe Room, Garden View", "Premium Room, Mountain View", "Luxury Suite") },
  { id: "taj-madikeri-coorg", name: "Taj Madikeri Resort & Spa", brand: "taj", city: "Coorg", state: "Karnataka", website: TAJ_SITE, roomTypes: rooms("Premium Room, Forest View", "Pool Villa", "Luxury Suite") },
  { id: "oberoi-amarvilas-agra", name: "The Oberoi Amarvilas", brand: "oberoi", city: "Agra", state: "Uttar Pradesh", website: "https://www.oberoihotels.com/", roomTypes: rooms("Premier Room, Taj View", "Luxury Suite", "Kohinoor Suite") },
  { id: "oberoi-mumbai", name: "The Oberoi, Mumbai", brand: "oberoi", city: "Mumbai", state: "Maharashtra", website: "https://www.oberoihotels.com/", roomTypes: rooms("Deluxe Room, City View", "Premier Room, Ocean View", "Luxury Suite") },
  { id: "leela-palace-udaipur", name: "The Leela Palace Udaipur", brand: "leela", city: "Udaipur", state: "Rajasthan", website: "https://www.theleela.com/", roomTypes: rooms("Grand Heritage Room, Lake View", "Royal Club Room", "Maharaja Suite") },
  { id: "leela-palace-new-delhi", name: "The Leela Palace New Delhi", brand: "leela", city: "New Delhi", state: "Delhi", website: "https://www.theleela.com/", roomTypes: rooms("Deluxe Room", "Grande Deluxe Room", "Royal Club Room") },
  { id: "itc-grand-chola-chennai", name: "ITC Grand Chola", brand: "itc", city: "Chennai", state: "Tamil Nadu", website: "https://www.itchotels.com/", roomTypes: rooms("Executive Club Room", "ITC One Room", "Towers Suite") },
];

export const DEFAULT_TARGET = "brand:taj";

export interface SearchTarget {
  value: string;
  label: string;
  kind: "all" | "brand" | "city" | "hotel";
  detail: string;
  hotelIds: string[];
}

export function citySlug(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function plural(n: number, word: string): string {
  if (n === 1) return `1 ${word}`;
  return `${n} ${word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}s`}`;
}

export function listTargets(): SearchTarget[] {
  const targets: SearchTarget[] = [];
  for (const [brand, label] of Object.entries(BRANDS) as [BrandId, string][]) {
    const ids = HOTELS.filter((h) => h.brand === brand).map((h) => h.id);
    targets.push({ value: `brand:${brand}`, label: `All ${label} hotels`, kind: "brand", detail: plural(ids.length, "property"), hotelIds: ids });
  }
  targets.push({ value: "all", label: "All tracked luxury hotels", kind: "all", detail: plural(HOTELS.length, "property"), hotelIds: HOTELS.map((h) => h.id) });
  const cities = [...new Set(HOTELS.map((h) => h.city))].sort();
  for (const city of cities) {
    const inCity = HOTELS.filter((h) => h.city === city);
    targets.push({ value: `city:${citySlug(city)}`, label: city, kind: "city", detail: plural(inCity.length, "hotel"), hotelIds: inCity.map((h) => h.id) });
  }
  for (const hotel of HOTELS) {
    targets.push({ value: `hotel:${hotel.id}`, label: hotel.name, kind: "hotel", detail: `${BRANDS[hotel.brand]} · ${hotel.city}`, hotelIds: [hotel.id] });
  }
  return targets;
}

export function resolveTarget(value: string): SearchTarget | undefined {
  return listTargets().find((t) => t.value === value);
}

export function getHotel(id: string): Hotel | undefined {
  return HOTELS.find((h) => h.id === id);
}

/** Case-insensitive match against hotel, brand, city and state names. */
export function searchTargets(term: string): SearchTarget[] {
  const all = listTargets();
  const q = term.trim().toLowerCase();
  if (!q) return all;
  return all.filter((t) => {
    if (t.label.toLowerCase().includes(q) || t.detail.toLowerCase().includes(q)) return true;
    return t.hotelIds.some((id) => {
      const h = getHotel(id)!;
      return t.kind === "hotel" && (h.state.toLowerCase().includes(q) || h.city.toLowerCase().includes(q));
    });
  });
}
