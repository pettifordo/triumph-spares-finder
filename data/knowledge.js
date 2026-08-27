/* Triumph domain knowledge: models, part categories, part-number formats,
 * and UK geography. Plain script (no modules) so index.html also works when
 * opened straight off disk.
 *
 * Everything here is editable data, not logic. Correcting a synonym or adding
 * a keyword changes ranking immediately — no code changes needed.
 */

/* ------------------------------------------------------------------ models */
/* `family` groups models that share most parts, so a supplier who covers the
 * family still scores well on a specific model it doesn't list explicitly.  */
const TRIUMPH_MODELS = [
  { id: 'tr2',       label: 'TR2',            family: 'sidescreen-tr', years: '1953–1955', synonyms: ['tr2'] },
  { id: 'tr3',       label: 'TR3 / TR3A / TR3B', family: 'sidescreen-tr', years: '1955–1962', synonyms: ['tr3', 'tr3a', 'tr3b', 'sidescreen', 'side screen'] },
  { id: 'tr4',       label: 'TR4 / TR4A',     family: 'big-tr', years: '1961–1967', synonyms: ['tr4', 'tr4a', 'irs'] },
  { id: 'tr5',       label: 'TR5 / TR250',    family: 'big-tr', years: '1967–1968', synonyms: ['tr5', 'tr250', 'pi', 'petrol injection'] },
  { id: 'tr6',       label: 'TR6',            family: 'big-tr', years: '1968–1976', synonyms: ['tr6'] },
  { id: 'tr7',       label: 'TR7',            family: 'wedge', years: '1974–1981', synonyms: ['tr7', 'wedge'] },
  { id: 'tr8',       label: 'TR8',            family: 'wedge', years: '1978–1982', synonyms: ['tr8'] },
  { id: 'spitfire',  label: 'Spitfire',       family: 'small-chassis', years: '1962–1980', synonyms: ['spitfire', 'spit', 'mk1 spitfire', 'spitfire 1500'] },
  { id: 'gt6',       label: 'GT6',            family: 'small-chassis', years: '1966–1973', synonyms: ['gt6', 'gt 6'] },
  { id: 'herald',    label: 'Herald',         family: 'small-chassis', years: '1959–1971', synonyms: ['herald', '13/60', '12/50', '948', '1200 herald'] },
  { id: 'vitesse',   label: 'Vitesse',        family: 'small-chassis', years: '1962–1971', synonyms: ['vitesse'] },
  { id: 'stag',      label: 'Stag',           family: 'stag', years: '1970–1977', synonyms: ['stag'] },
  { id: 'dolomite',  label: 'Dolomite / Sprint', family: 'saloon', years: '1972–1980', synonyms: ['dolomite', 'dolly', 'sprint', 'dolomite sprint'] },
  { id: 'toledo',    label: 'Toledo',         family: 'saloon', years: '1970–1976', synonyms: ['toledo'] },
  { id: '2000',      label: '2000 / 2500 / 2.5 PI', family: 'big-saloon', years: '1963–1977', synonyms: ['2000', '2500', '2.5pi', '2.5 pi', 'mk2 saloon', '2500s', '2000tc'] },
  { id: '1300',      label: '1300 / 1500 (FWD)', family: 'saloon', years: '1965–1973', synonyms: ['1300', '1500tc', 'front wheel drive'] },
  { id: 'acclaim',   label: 'Acclaim',        family: 'acclaim', years: '1981–1984', synonyms: ['acclaim'] },
  { id: 'mayflower', label: 'Mayflower',      family: 'prewar-postwar', years: '1949–1953', synonyms: ['mayflower'] },
  { id: 'renown',    label: 'Renown / Roadster', family: 'prewar-postwar', years: '1946–1954', synonyms: ['renown', 'roadster', '1800', 'razoredge'] },
  { id: 'italia',    label: 'Italia 2000',    family: 'big-tr', years: '1959–1962', synonyms: ['italia'] },
];

/* Triumph also made motorcycles. A search for "Bonneville primary cover" in a
 * car-parts tool should say so rather than silently return car specialists. */
const MOTORCYCLE_TERMS = [
  'bonneville', 'thruxton', 'tiger 900', 'tiger 800', 'speed triple', 'street triple',
  'daytona 675', 'rocket 3', 'rocket iii', 'scrambler', 'trident', 'tiger cub',
  't120', 't140', 'trophy', 'sprocket', 'swingarm', 'fork seal', 'chain and sprocket',
];

/* -------------------------------------------------------------- categories */
const PART_CATEGORIES = [
  { id: 'engine', label: 'Engine', keywords: ['engine', 'block', 'cylinder head', 'head gasket', 'gasket', 'piston', 'ring', 'crank', 'crankshaft', 'camshaft', 'cam', 'timing chain', 'tensioner', 'oil pump', 'sump', 'tappet', 'rocker', 'valve', 'con rod', 'bearing', 'shell', 'oil filter', 'flywheel', 'core plug', 'rebuild'] },
  { id: 'fuel', label: 'Fuel & carburettors', keywords: ['carb', 'carburettor', 'carburetor', 'su', 'hs6', 'hs4', 'hs2', 'stromberg', 'cd150', 'cd175', 'zenith', 'needle', 'jet', 'float', 'petrol pump', 'fuel pump', 'fuel tank', 'petrol tank', 'sender', 'injection', 'lucas pi', 'metering unit', 'throttle', 'choke', 'air filter', 'manifold'] },
  { id: 'electrical', label: 'Electrical & ignition', keywords: ['electrical', 'wiring', 'loom', 'harness', 'dynamo', 'alternator', 'distributor', 'dizzy', 'points', 'condenser', 'coil', 'plug lead', 'spark plug', 'fuse', 'relay', 'switch', 'indicator', 'headlamp', 'headlight', 'tail light', 'lamp', 'bulb', 'instrument', 'gauge', 'tacho', 'tachometer', 'speedo', 'speedometer', 'lucas', 'solenoid', 'starter', 'battery', 'horn', 'wiper motor'] },
  { id: 'cooling', label: 'Cooling', keywords: ['radiator', 'rad', 'water pump', 'thermostat', 'fan', 'hose', 'header tank', 'expansion tank', 'coolant', 'core', 'fan belt'] },
  { id: 'exhaust', label: 'Exhaust', keywords: ['exhaust', 'downpipe', 'silencer', 'backbox', 'tailpipe', 'manifold', 'header', 'extractor', 'exhaust clamp'] },
  { id: 'transmission', label: 'Gearbox & clutch', keywords: ['gearbox', 'transmission', 'overdrive', 'a-type', 'j-type', 'd-type', 'laycock', 'clutch', 'slave cylinder', 'master cylinder', 'release bearing', 'propshaft', 'prop shaft', 'gaiter', 'synchro', 'layshaft', 'gear lever', 'gearknob', 'bellhousing'] },
  { id: 'axle', label: 'Axle & differential', keywords: ['differential', 'diff', 'halfshaft', 'half shaft', 'crownwheel', 'crown wheel', 'pinion', 'driveshaft', 'drive shaft', 'uj', 'universal joint', 'rotoflex', 'axle', 'hub'] },
  { id: 'suspension', label: 'Suspension', keywords: ['suspension', 'spring', 'damper', 'shock', 'shocker', 'trunnion', 'vertical link', 'wishbone', 'bush', 'bushes', 'polybush', 'anti-roll', 'anti roll', 'leaf', 'torsion', 'transverse', 'lower arm', 'ball joint'] },
  { id: 'steering', label: 'Steering', keywords: ['steering', 'rack', 'track rod', 'tie rod', 'steering box', 'column', 'steering wheel', 'idler', 'boss', 'moto-lita', 'motolita'] },
  { id: 'brakes', label: 'Brakes', keywords: ['brake', 'brakes', 'caliper', 'calliper', 'disc', 'rotor', 'drum', 'pad', 'shoe', 'servo', 'master cylinder', 'wheel cylinder', 'handbrake', 'flexi', 'brake hose', 'brake pipe', 'brake line', 'bleed'] },
  { id: 'body', label: 'Body & chassis', keywords: ['wing', 'panel', 'sill', 'door', 'bonnet', 'boot', 'floor pan', 'floorpan', 'valance', 'chassis', 'outrigger', 'repair panel', 'body', 'shell', 'a-post', 'b-post', 'quarter', 'skin', 'welding', 'rust', 'apron'] },
  { id: 'trim', label: 'Interior & trim', keywords: ['seat', 'seats', 'carpet', 'carpets', 'trim', 'headlining', 'head lining', 'door card', 'door panel', 'dashboard', 'dash', 'veneer', 'walnut', 'vinyl', 'leather', 'upholstery', 'sun visor', 'armrest', 'console'] },
  { id: 'hood', label: 'Hood & weather gear', keywords: ['hood', 'soft top', 'softtop', 'tonneau', 'hood frame', 'hardtop', 'hard top', 'seal', 'weatherstrip', 'weather strip', 'rubber', 'hood cover', 'sidescreen'] },
  { id: 'chrome', label: 'Chrome & brightwork', keywords: ['badge', 'bumper', 'overrider', 'over rider', 'grille', 'grill', 'mirror', 'chrome', 'windscreen', 'windshield', 'trim strip', 'handle', 'escutcheon', 'motif', 'emblem'] },
  { id: 'wheels', label: 'Wheels & tyres', keywords: ['wheel', 'wheels', 'wire wheel', 'spoke', 'spinner', 'knock on', 'knock-on', 'rostyle', 'minilite', 'tyre', 'tire', 'wheel nut', 'stud', 'hub cap', 'hubcap', 'wheel trim'] },
  { id: 'literature', label: 'Manuals & tools', keywords: ['manual', 'workshop manual', 'handbook', 'parts catalogue', 'parts catalog', 'book', 'literature', 'tool kit', 'toolkit', 'jack', 'wiring diagram'] },
];

/* --------------------------------------------------- part number formats */
/* Ordered: first match wins, so put the most specific patterns first.
 * Notes are deliberately hedged where the numbering convention is community
 * knowledge rather than something we can verify from a primary source. */
const PART_NUMBER_FORMATS = [
  {
    id: 'moss',
    label: 'Moss-style catalogue number',
    test: /^\d{3}-\d{3}$/,
    note: 'Looks like a Moss catalogue number (three digits, hyphen, three digits) rather than a Triumph factory number.',
    boosts: ['moss-europe', 'moss-motors'],
  },
  {
    id: 'bl-alpha',
    label: 'British Leyland alphanumeric part number',
    test: /^[A-Z]{2,4}\d{3,5}[A-Z]?$/i,
    note: 'BL-era prefix + digits (the UKC/TKC/RKC/GHC style seen on 1970s Triumphs). Most established specialists cross-reference these.',
    boosts: [],
  },
  {
    id: 'oe-triumph',
    label: 'Standard-Triumph factory part number',
    test: /^\d{5,7}[A-Z]?$/,
    note: 'Six-digit-style factory number. Cross-reference quality varies between suppliers — specialists are usually best.',
    boosts: [],
  },
  {
    id: 'supplier-sku',
    label: 'Supplier stock code',
    test: /^[A-Z]{1,3}[- ]?\d{2,6}$/i,
    note: 'Could be a supplier stock code rather than a factory number. Worth searching the factory number too if you have it.',
    boosts: [],
  },
];

/* --------------------------------------------------------------- condition */
const CONDITION_TERMS = {
  new: ['new', 'repro', 'reproduction', 'aftermarket', 'pattern'],
  nos: ['nos', 'new old stock', 'genuine', 'original', 'oe', 'oem'],
  used: ['used', 'second hand', 'secondhand', 'breaking', 'breaker', 'salvage', 'donor', 'scrap'],
};

/* Suppliers under common ownership. Worth surfacing, because "if one is out of
 * stock, try the other" is weaker advice when both belong to the same group. */
const SUPPLIER_GROUPS = {
  'moss-rimmer': {
    label: 'Moss / Rimmer group',
    note:
      'Moss Europe, Moss Motors and Rimmer Bros are under common ownership (Radial Equity ' +
      'Partners) and trade as a partnership. They still run separate websites, catalogues, ' +
      'stock and pricing, so checking both is still worth doing — but treat them as one ' +
      'group rather than two independent opinions.',
  },
};

/* Words that mean "I don't want the standard part". Without one of these, a
 * competition-parts house should sit below the general catalogues, however
 * precisely it matches the category. */
const PERFORMANCE_TERMS = [
  'uprated', 'upgrade', 'upgraded', 'fast road', 'competition', 'race', 'racing',
  'rally', 'motorsport', 'performance', 'poly', 'polybush', 'polyurethane',
  'big valve', 'high lift', 'lightened', 'balanced', 'close ratio', 'lsd',
  'limited slip', 'vented', 'four pot', '4 pot', 'stainless',
];

/* -------------------------------------------------------------- geography */
/* Approximate centroids for UK postcode areas — good enough to rank suppliers
 * by distance, not good enough for navigation. */
const POSTCODE_AREAS = {
  AB: [57.15, -2.10], AL: [51.75, -0.34], B: [52.48, -1.90], BA: [51.38, -2.36],
  BB: [53.75, -2.48], BD: [53.80, -1.75], BH: [50.72, -1.88], BL: [53.58, -2.43],
  BN: [50.83, -0.14], BR: [51.40, 0.02], BS: [51.45, -2.59], BT: [54.60, -5.93],
  CA: [54.89, -2.94], CB: [52.21, 0.12], CF: [51.48, -3.18], CH: [53.19, -2.89],
  CM: [51.73, 0.48], CO: [51.89, 0.90], CR: [51.37, -0.10], CT: [51.28, 1.08],
  CV: [52.41, -1.51], CW: [53.10, -2.44], DA: [51.44, 0.22], DD: [56.46, -2.97],
  DE: [52.92, -1.48], DG: [55.07, -3.60], DH: [54.78, -1.57], DL: [54.52, -1.55],
  DN: [53.52, -1.13], DT: [50.71, -2.44], DY: [52.51, -2.09], E: [51.53, -0.03],
  EC: [51.52, -0.09], EH: [55.95, -3.19], EN: [51.65, -0.08], EX: [50.72, -3.53],
  FK: [56.00, -3.79], FY: [53.82, -3.05], G: [55.86, -4.25], GL: [51.86, -2.24],
  GU: [51.24, -0.57], GY: [49.45, -2.58], HA: [51.58, -0.34], HD: [53.65, -1.78],
  HG: [53.99, -1.54], HP: [51.75, -0.47], HR: [52.06, -2.72], HS: [57.90, -6.80],
  HU: [53.74, -0.34], HX: [53.72, -1.86], IG: [51.56, 0.08], IM: [54.15, -4.48],
  IP: [52.06, 1.16], IV: [57.48, -4.22], JE: [49.19, -2.11], KA: [55.61, -4.50],
  KT: [51.41, -0.30], KW: [58.98, -2.96], KY: [56.11, -3.16], L: [53.41, -2.98],
  LA: [54.05, -2.80], LD: [52.24, -3.38], LE: [52.64, -1.13], LL: [53.28, -3.83],
  LN: [53.23, -0.54], LS: [53.80, -1.55], LU: [51.88, -0.42], M: [53.48, -2.24],
  ME: [51.38, 0.53], MK: [52.04, -0.76], ML: [55.79, -3.99], N: [51.57, -0.11],
  NE: [54.98, -1.61], NG: [52.95, -1.15], NN: [52.24, -0.90], NP: [51.58, -3.00],
  NR: [52.63, 1.30], NW: [51.55, -0.20], OL: [53.54, -2.11], OX: [51.75, -1.26],
  PA: [55.85, -4.42], PE: [52.57, -0.24], PH: [56.40, -3.44], PL: [50.38, -4.14],
  PO: [50.80, -1.09], PR: [53.76, -2.70], RG: [51.45, -0.97], RH: [51.24, -0.17],
  RM: [51.58, 0.18], S: [53.38, -1.47], SA: [51.62, -3.94], SE: [51.47, -0.05],
  SG: [51.90, -0.20], SK: [53.41, -2.16], SL: [51.51, -0.59], SM: [51.36, -0.19],
  SN: [51.56, -1.78], SO: [50.91, -1.40], SP: [51.07, -1.79], SR: [54.90, -1.38],
  SS: [51.54, 0.71], ST: [53.00, -2.18], SW: [51.46, -0.16], SY: [52.71, -2.75],
  TA: [51.02, -3.10], TD: [55.61, -2.80], TF: [52.68, -2.45], TN: [51.19, 0.27],
  TQ: [50.46, -3.53], TR: [50.26, -5.05], TS: [54.57, -1.23], TW: [51.45, -0.33],
  UB: [51.51, -0.42], W: [51.51, -0.19], WA: [53.39, -2.60], WC: [51.52, -0.12],
  WD: [51.66, -0.40], WF: [53.68, -1.50], WN: [53.54, -2.63], WR: [52.19, -2.22],
  WS: [52.59, -1.98], WV: [52.59, -2.13], YO: [53.96, -1.08], ZE: [60.15, -1.15],
};

/* Fallback pickers for people who would rather not type a postcode. */
const UK_REGIONS = [
  { id: 'scotland',   label: 'Scotland',            coords: [56.49, -4.20] },
  { id: 'ne',         label: 'North East England',  coords: [54.90, -1.60] },
  { id: 'nw',         label: 'North West England',  coords: [53.60, -2.60] },
  { id: 'yorkshire',  label: 'Yorkshire & Humber',  coords: [53.80, -1.30] },
  { id: 'wmids',      label: 'West Midlands',       coords: [52.48, -1.90] },
  { id: 'emids',      label: 'East Midlands',       coords: [52.85, -1.10] },
  { id: 'eastanglia', label: 'East of England',     coords: [52.35, 0.60] },
  { id: 'london',     label: 'London',              coords: [51.51, -0.13] },
  { id: 'se',         label: 'South East England',  coords: [51.15, -0.60] },
  { id: 'sw',         label: 'South West England',  coords: [50.90, -3.20] },
  { id: 'wales',      label: 'Wales',               coords: [52.40, -3.60] },
  { id: 'ni',         label: 'Northern Ireland',    coords: [54.60, -6.20] },
];
