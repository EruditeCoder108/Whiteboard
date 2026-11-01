/**
 * The periodic table as data: number, symbol, name, standard atomic weight (IUPAC abridged; in brackets
 * in the display for elements with no stable isotope, the mass number of the longest-lived one),
 * family, and place in the table. Row 8 and 9 are the lanthanides and actinides, drawn below the table.
 */
export type Family = 'alkali' | 'alkaline' | 'transition' | 'post' | 'metalloid' | 'nonmetal' | 'halogen' | 'noble' | 'lanthanide' | 'actinide' | 'unknown'

export const FAMILY_NAMES: Record<Family, string> = {
  alkali: 'Alkali metal', alkaline: 'Alkaline earth metal', transition: 'Transition metal', post: 'Post-transition metal',
  metalloid: 'Metalloid', nonmetal: 'Non-metal', halogen: 'Halogen', noble: 'Noble gas',
  lanthanide: 'Lanthanide', actinide: 'Actinide', unknown: 'Properties not yet known'
}
export const FAMILY_COLORS: Record<Family, string> = {
  alkali: '#ffc9b8', alkaline: '#ffe0a8', transition: '#f6dfe6', post: '#cfe3f7', metalloid: '#d4eccd',
  nonmetal: '#fff4b0', halogen: '#c8f0e4', noble: '#dcd3f7', lanthanide: '#f7d3ee', actinide: '#f3c6c6', unknown: '#e4e7ec'
}

export interface Element {
  z: number; symbol: string; name: string; mass: string; family: Family
  /** column 1–18 and row 1–9 where it is drawn */
  col: number; row: number
  /** its real group (none for the f-block) and period */
  group: number | null; period: number
}

// z symbol name mass family col row
const RAW = `1 H Hydrogen 1.008 nonmetal 1 1
2 He Helium 4.0026 noble 18 1
3 Li Lithium 6.94 alkali 1 2
4 Be Beryllium 9.0122 alkaline 2 2
5 B Boron 10.81 metalloid 13 2
6 C Carbon 12.011 nonmetal 14 2
7 N Nitrogen 14.007 nonmetal 15 2
8 O Oxygen 15.999 nonmetal 16 2
9 F Fluorine 18.998 halogen 17 2
10 Ne Neon 20.180 noble 18 2
11 Na Sodium 22.990 alkali 1 3
12 Mg Magnesium 24.305 alkaline 2 3
13 Al Aluminium 26.982 post 13 3
14 Si Silicon 28.085 metalloid 14 3
15 P Phosphorus 30.974 nonmetal 15 3
16 S Sulfur 32.06 nonmetal 16 3
17 Cl Chlorine 35.45 halogen 17 3
18 Ar Argon 39.95 noble 18 3
19 K Potassium 39.098 alkali 1 4
20 Ca Calcium 40.078 alkaline 2 4
21 Sc Scandium 44.956 transition 3 4
22 Ti Titanium 47.867 transition 4 4
23 V Vanadium 50.942 transition 5 4
24 Cr Chromium 51.996 transition 6 4
25 Mn Manganese 54.938 transition 7 4
26 Fe Iron 55.845 transition 8 4
27 Co Cobalt 58.933 transition 9 4
28 Ni Nickel 58.693 transition 10 4
29 Cu Copper 63.546 transition 11 4
30 Zn Zinc 65.38 transition 12 4
31 Ga Gallium 69.723 post 13 4
32 Ge Germanium 72.630 metalloid 14 4
33 As Arsenic 74.922 metalloid 15 4
34 Se Selenium 78.971 nonmetal 16 4
35 Br Bromine 79.904 halogen 17 4
36 Kr Krypton 83.798 noble 18 4
37 Rb Rubidium 85.468 alkali 1 5
38 Sr Strontium 87.62 alkaline 2 5
39 Y Yttrium 88.906 transition 3 5
40 Zr Zirconium 91.224 transition 4 5
41 Nb Niobium 92.906 transition 5 5
42 Mo Molybdenum 95.95 transition 6 5
43 Tc Technetium [97] transition 7 5
44 Ru Ruthenium 101.07 transition 8 5
45 Rh Rhodium 102.91 transition 9 5
46 Pd Palladium 106.42 transition 10 5
47 Ag Silver 107.87 transition 11 5
48 Cd Cadmium 112.41 transition 12 5
49 In Indium 114.82 post 13 5
50 Sn Tin 118.71 post 14 5
51 Sb Antimony 121.76 metalloid 15 5
52 Te Tellurium 127.60 metalloid 16 5
53 I Iodine 126.90 halogen 17 5
54 Xe Xenon 131.29 noble 18 5
55 Cs Caesium 132.91 alkali 1 6
56 Ba Barium 137.33 alkaline 2 6
57 La Lanthanum 138.91 lanthanide 3 8
58 Ce Cerium 140.12 lanthanide 4 8
59 Pr Praseodymium 140.91 lanthanide 5 8
60 Nd Neodymium 144.24 lanthanide 6 8
61 Pm Promethium [145] lanthanide 7 8
62 Sm Samarium 150.36 lanthanide 8 8
63 Eu Europium 151.96 lanthanide 9 8
64 Gd Gadolinium 157.25 lanthanide 10 8
65 Tb Terbium 158.93 lanthanide 11 8
66 Dy Dysprosium 162.50 lanthanide 12 8
67 Ho Holmium 164.93 lanthanide 13 8
68 Er Erbium 167.26 lanthanide 14 8
69 Tm Thulium 168.93 lanthanide 15 8
70 Yb Ytterbium 173.05 lanthanide 16 8
71 Lu Lutetium 174.97 lanthanide 17 8
72 Hf Hafnium 178.49 transition 4 6
73 Ta Tantalum 180.95 transition 5 6
74 W Tungsten 183.84 transition 6 6
75 Re Rhenium 186.21 transition 7 6
76 Os Osmium 190.23 transition 8 6
77 Ir Iridium 192.22 transition 9 6
78 Pt Platinum 195.08 transition 10 6
79 Au Gold 196.97 transition 11 6
80 Hg Mercury 200.59 transition 12 6
81 Tl Thallium 204.38 post 13 6
82 Pb Lead 207.2 post 14 6
83 Bi Bismuth 208.98 post 15 6
84 Po Polonium [209] post 16 6
85 At Astatine [210] halogen 17 6
86 Rn Radon [222] noble 18 6
87 Fr Francium [223] alkali 1 7
88 Ra Radium [226] alkaline 2 7
89 Ac Actinium [227] actinide 3 9
90 Th Thorium 232.04 actinide 4 9
91 Pa Protactinium 231.04 actinide 5 9
92 U Uranium 238.03 actinide 6 9
93 Np Neptunium [237] actinide 7 9
94 Pu Plutonium [244] actinide 8 9
95 Am Americium [243] actinide 9 9
96 Cm Curium [247] actinide 10 9
97 Bk Berkelium [247] actinide 11 9
98 Cf Californium [251] actinide 12 9
99 Es Einsteinium [252] actinide 13 9
100 Fm Fermium [257] actinide 14 9
101 Md Mendelevium [258] actinide 15 9
102 No Nobelium [259] actinide 16 9
103 Lr Lawrencium [266] actinide 17 9
104 Rf Rutherfordium [267] transition 4 7
105 Db Dubnium [268] transition 5 7
106 Sg Seaborgium [269] transition 6 7
107 Bh Bohrium [270] transition 7 7
108 Hs Hassium [277] transition 8 7
109 Mt Meitnerium [278] unknown 9 7
110 Ds Darmstadtium [281] unknown 10 7
111 Rg Roentgenium [282] unknown 11 7
112 Cn Copernicium [285] transition 12 7
113 Nh Nihonium [286] unknown 13 7
114 Fl Flerovium [289] unknown 14 7
115 Mc Moscovium [290] unknown 15 7
116 Lv Livermorium [293] unknown 16 7
117 Ts Tennessine [294] unknown 17 7
118 Og Oganesson [294] unknown 18 7`

export const ELEMENTS: Element[] = RAW.split('\n').map(line => {
  const [z, symbol, name, mass, family, col, row] = line.trim().split(' ')
  const r = Number(row), c = Number(col)
  return { z: Number(z), symbol, name, mass, family: family as Family, col: c, row: r, group: r >= 8 ? null : c, period: r === 8 ? 6 : r === 9 ? 7 : r }
})

const CELL = 96, GAP = 4, TOP = 12, DROP = 28

const cellAt = (el: Element): [number, number] => [(el.col - 1) * (CELL + GAP) + TOP, (el.row - 1) * (CELL + GAP) + TOP + (el.row >= 8 ? DROP : 0)]
export const TABLE_W = 18 * (CELL + GAP) + 2 * TOP - GAP
export const TABLE_H = 9 * (CELL + GAP) + 2 * TOP + DROP - GAP

function paintCell(ctx: CanvasRenderingContext2D, el: Element, x: number, y: number, size: number): void {
  const font = (weight: number | string, px: number): string => `${weight} ${px}px "Segoe UI", sans-serif`
  ctx.fillStyle = FAMILY_COLORS[el.family]
  ctx.beginPath(); ctx.roundRect(x, y, size, size, size * .08); ctx.fill()
  ctx.fillStyle = '#172033'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'; ctx.font = font(600, size * .15); ctx.fillText(String(el.z), x + size * .07, y + size * .2)
  ctx.textAlign = 'center'; ctx.font = font(700, size * .36); ctx.fillText(el.symbol, x + size / 2, y + size * .58)
  ctx.font = font(500, size * .115); ctx.fillText(el.name, x + size / 2, y + size * .76, size * .94)
  ctx.font = font(400, size * .115); ctx.fillText(el.mass, x + size / 2, y + size * .91, size * .94)
}

/** The whole table as a picture on white, sharp enough to fill a board. */
export function paintTable(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, TABLE_W, TABLE_H)
  for (const el of ELEMENTS) { const [x, y] = cellAt(el); paintCell(ctx, el, x, y, CELL) }
}

/** One element, as a large card. */
export function paintElement(ctx: CanvasRenderingContext2D, el: Element, size: number): void { paintCell(ctx, el, 0, 0, size) }
