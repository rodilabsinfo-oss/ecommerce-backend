/**
 * Kangaroo Mobile Zone (Birtamode, Jhapa): premium Apple phones and accessories.
 *
 * Shop look, contact details and a starter catalogue. Prices and stock are
 * SAMPLES for the demo — the shop replaces them from the staff desk.
 * Photos are drawn device images served by the storefront from
 * /brands/kangaroo/products/, until real photos are uploaded.
 */
import { prisma } from '../../src/lib/prisma.js';
import { toPaisa } from '../../src/lib/money.js';
import { createProduct } from '../../src/modules/catalog/product.service.js';

export const KANGAROO_SLUG = 'kangaroo';
const BRAND = '/brands/kangaroo';

export const KANGAROO_SETTINGS = {
  theme: {
    preset: 'carbon',
    colorMode: 'system',
    logoUrl: `${BRAND}/logo.svg`,
    logoDarkUrl: `${BRAND}/logo-dark.svg`,
    iconUrl: `${BRAND}/mark.svg`,
    // Kangaroo red from the logo; a lighter red reads better on dark backgrounds.
    accentColor: '#e50012',
    accentColorDark: '#ff4d4f',
    heroEyebrow: 'Kangaroo Mobile Zone · Birtamode',
    heroTitle: 'The latest Apple, in your hands today.',
    heroSubtitle: 'iPhone, iPad, Mac, Apple Watch and AirPods. Genuine products, sealed boxes and expert setup. Visit us in Birtamode or order for delivery.',
  },
  translations: {
    ne: {
      heroEyebrow: 'कङ्गारु मोबाइल जोन · बिर्तामोड',
      heroTitle: 'नयाँ एप्पल, आजै तपाईंको हातमा।',
      heroSubtitle: 'आईफोन, आईप्याड, म्याक, एप्पल वाच र एयरपड्स। सक्कली सामान, सिल गरिएको बाकस र सेटअपमा सहयोग। बिर्तामोडमा आउनुहोस् वा घरमै मगाउनुहोस्।',
      address: 'बिर्तामोड, झापा, कोशी प्रदेश',
    },
  },
  catalog: { kind: 'electronics' },
  // Phone and WhatsApp are left for the shop to fill in from Settings.
  contact: { address: 'Birtamode, Jhapa, Koshi Province' },
  social: { facebook: 'https://www.facebook.com/profile.php?id=61582131350333' },
  payments: { enabled: ['COD'] },
  shipping: { flatFee: toPaisa(150), freeAbove: toPaisa(10000) },
};

const CATEGORIES = [
  { slug: 'iphone', name: 'iPhone', ne: 'आईफोन' },
  { slug: 'ipad', name: 'iPad', ne: 'आईप्याड' },
  { slug: 'mac', name: 'Mac', ne: 'म्याक' },
  { slug: 'watch', name: 'Watch', ne: 'एप्पल वाच' },
  { slug: 'airpods', name: 'AirPods', ne: 'एयरपड्स' },
  { slug: 'accessories', name: 'Accessories', ne: 'एक्सेसरिज' },
] as const;

type Colour = { value: string; swatch: string };
/** One storage / size choice and its price in rupees. */
type Tier = { value: string; price: number; compareAt?: number };

export interface CatalogueItem {
  name: string;
  slug: string;
  category: (typeof CATEGORIES)[number]['slug'];
  /** Which drawing to use for the demo photo. */
  kind: 'phone' | 'laptop' | 'tablet' | 'watch' | 'airpods' | 'adapter' | 'magsafe' | 'cable' | 'case';
  style?: 'pro' | 'air' | 'standard' | 'ultra';
  description: string;
  descriptionNe: string;
  tags: string[];
  featured?: boolean;
  /** "Storage" for phones, iPads and Macs; "Size" for watches. Leave out when there is one version. */
  tierName?: 'Storage' | 'Size';
  tiers: Tier[];
  colours: Colour[];
}

const ORANGE = { value: 'Cosmic Orange', swatch: '#e2733a' };
const DEEP_BLUE = { value: 'Deep Blue', swatch: '#2f3d5c' };
const SILVER = { value: 'Silver', swatch: '#e3e4e6' };
/** The first colour is the one shown in lists, so each model leads with a different one. */
const PRO_COLOURS: Colour[] = [ORANGE, DEEP_BLUE, SILVER];
const PRO_COLOURS_BLUE_FIRST: Colour[] = [DEEP_BLUE, ORANGE, SILVER];
const WHITE: Colour[] = [{ value: 'White', swatch: '#f5f5f7' }];

export const KANGAROO_CATALOGUE: CatalogueItem[] = [
  {
    name: 'iPhone 17 Pro Max',
    slug: 'iphone-17-pro-max',
    category: 'iphone',
    kind: 'phone',
    style: 'pro',
    featured: true,
    description:
      'The biggest, most capable iPhone. A 6.9-inch Super Retina XDR display with ProMotion, the A19 Pro chip, an aluminium unibody design and a pro camera system with three 48MP cameras.\n\nSealed box, genuine Apple product. We help you move your data and set it up before you leave the store.',
    descriptionNe:
      'सबैभन्दा ठूलो र शक्तिशाली आईफोन। ६.९ इन्चको डिस्प्ले, A19 Pro चिप र तीनवटा 48MP क्यामेरा।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान। पसलमै डाटा सार्न र सेटअप गर्न सहयोग गर्छौं।',
    tags: ['iphone', 'pro', 'flagship', 'apple'],
    tierName: 'Storage',
    tiers: [
      { value: '256GB', price: 229999 },
      { value: '512GB', price: 264999 },
      { value: '1TB', price: 304999 },
      { value: '2TB', price: 379999 },
    ],
    colours: PRO_COLOURS,
  },
  {
    name: 'iPhone 17 Pro',
    slug: 'iphone-17-pro',
    category: 'iphone',
    kind: 'phone',
    style: 'pro',
    featured: true,
    description:
      'Pro power in a 6.3-inch size. The A19 Pro chip, a ProMotion display that goes up to 120Hz and the pro camera system with three 48MP cameras.\n\nSealed box, genuine Apple product.',
    descriptionNe: '६.३ इन्चमा प्रो क्षमता। A19 Pro चिप, १२०Hz सम्मको डिस्प्ले र तीनवटा 48MP क्यामेरा।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['iphone', 'pro', 'flagship', 'apple'],
    tierName: 'Storage',
    tiers: [
      { value: '256GB', price: 199999 },
      { value: '512GB', price: 234999 },
      { value: '1TB', price: 274999 },
    ],
    colours: PRO_COLOURS_BLUE_FIRST,
  },
  {
    name: 'iPhone Air',
    slug: 'iphone-air',
    category: 'iphone',
    kind: 'phone',
    style: 'air',
    featured: true,
    description:
      'The thinnest iPhone ever. A 6.5-inch ProMotion display and the A19 Pro chip in a light titanium design that disappears in your pocket.\n\nSealed box, genuine Apple product.',
    descriptionNe: 'अहिलेसम्मकै सबैभन्दा पातलो आईफोन। ६.५ इन्चको डिस्प्ले र A19 Pro चिप, हलुका टाइटानियम डिजाइनमा।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['iphone', 'air', 'thin', 'apple'],
    tierName: 'Storage',
    tiers: [
      { value: '256GB', price: 184999 },
      { value: '512GB', price: 219999 },
      { value: '1TB', price: 254999 },
    ],
    colours: [
      { value: 'Sky Blue', swatch: '#c9dceb' },
      { value: 'Light Gold', swatch: '#e6d8b9' },
      { value: 'Cloud White', swatch: '#f1f0ec' },
      { value: 'Space Black', swatch: '#232426' },
    ],
  },
  {
    name: 'iPhone 17',
    slug: 'iphone-17',
    category: 'iphone',
    kind: 'phone',
    style: 'standard',
    featured: true,
    description:
      'The everyday iPhone, upgraded. A 6.3-inch ProMotion display, the A19 chip, a 48MP Dual Fusion camera and an 18MP Center Stage front camera.\n\nSealed box, genuine Apple product.',
    descriptionNe: 'दैनिक प्रयोगको आईफोन, अझ राम्रो। ६.३ इन्च ProMotion डिस्प्ले, A19 चिप र 48MP डुअल क्यामेरा।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['iphone', 'apple'],
    tierName: 'Storage',
    tiers: [
      { value: '256GB', price: 139999 },
      { value: '512GB', price: 174999 },
    ],
    colours: [
      { value: 'Lavender', swatch: '#d6c8e6' },
      { value: 'Mist Blue', swatch: '#a7bcd2' },
      { value: 'Sage', swatch: '#a9b79c' },
      { value: 'White', swatch: '#f4f4f2' },
      { value: 'Black', swatch: '#2a2a2d' },
    ],
  },
  {
    name: 'iPhone 16',
    slug: 'iphone-16',
    category: 'iphone',
    kind: 'phone',
    style: 'standard',
    description:
      'Great value with Apple Intelligence. A 6.1-inch Super Retina XDR display, the A18 chip, Camera Control and a 48MP Fusion camera.\n\nSealed box, genuine Apple product.',
    descriptionNe: 'राम्रो मूल्यमा Apple Intelligence सहितको आईफोन। ६.१ इन्च डिस्प्ले, A18 चिप र 48MP क्यामेरा।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['iphone', 'apple', 'value'],
    tierName: 'Storage',
    tiers: [
      { value: '128GB', price: 114999, compareAt: 124999 },
      { value: '256GB', price: 129999, compareAt: 139999 },
    ],
    colours: [
      { value: 'Ultramarine', swatch: '#5d6fd6' },
      { value: 'Teal', swatch: '#a3cfc8' },
      { value: 'Pink', swatch: '#f1c5cf' },
      { value: 'White', swatch: '#f5f5f3' },
      { value: 'Black', swatch: '#2b2b2e' },
    ],
  },
  {
    name: 'MacBook Air 13" M4',
    slug: 'macbook-air-13-m4',
    category: 'mac',
    kind: 'laptop',
    featured: true,
    description:
      'Light, silent and fast. The M4 chip with 16GB unified memory, a 13.6-inch Liquid Retina display and all-day battery life.\n\nSealed box, genuine Apple product.',
    descriptionNe: 'हलुका, आवाजविनाको र छिटो। M4 चिप, 16GB मेमोरी, १३.६ इन्च डिस्प्ले र दिनभर चल्ने ब्याट्री।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['mac', 'macbook', 'laptop', 'apple'],
    tierName: 'Storage',
    tiers: [
      { value: '256GB', price: 164999 },
      { value: '512GB', price: 194999 },
    ],
    colours: [
      { value: 'Sky Blue', swatch: '#c6d6e2' },
      { value: 'Silver', swatch: '#e2e3e5' },
      { value: 'Starlight', swatch: '#efe3d2' },
      { value: 'Midnight', swatch: '#2e3641' },
    ],
  },
  {
    name: 'MacBook Pro 14" M5',
    slug: 'macbook-pro-14-m5',
    category: 'mac',
    kind: 'laptop',
    description:
      'Pro performance for creators. The M5 chip, a 14.2-inch Liquid Retina XDR display and a battery that lasts through the longest edit.\n\nSealed box, genuine Apple product.',
    descriptionNe: 'क्रिएटरहरूका लागि प्रो क्षमता। M5 चिप र १४.२ इन्चको Liquid Retina XDR डिस्प्ले।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['mac', 'macbook', 'pro', 'laptop', 'apple'],
    tierName: 'Storage',
    tiers: [
      { value: '512GB', price: 249999 },
      { value: '1TB', price: 284999 },
    ],
    colours: [
      { value: 'Space Black', swatch: '#2b2b2d' },
      { value: 'Silver', swatch: '#e2e3e5' },
    ],
  },
  {
    name: 'iPad Air 11" M3',
    slug: 'ipad-air-11-m3',
    category: 'ipad',
    kind: 'tablet',
    description:
      'Serious performance in a light design. The M3 chip, an 11-inch Liquid Retina display and support for Apple Pencil Pro.\n\nSealed box, genuine Apple product.',
    descriptionNe: 'हलुका डिजाइनमा बलियो क्षमता। M3 चिप, ११ इन्च डिस्प्ले र Apple Pencil Pro चल्ने।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['ipad', 'tablet', 'apple'],
    tierName: 'Storage',
    tiers: [
      { value: '128GB', price: 94999 },
      { value: '256GB', price: 109999 },
    ],
    colours: [
      { value: 'Space Grey', swatch: '#5f6064' },
      { value: 'Blue', swatch: '#b6c6d8' },
      { value: 'Purple', swatch: '#d2c5df' },
      { value: 'Starlight', swatch: '#ece2d2' },
    ],
  },
  {
    name: 'iPad Pro 11" M5',
    slug: 'ipad-pro-11-m5',
    category: 'ipad',
    kind: 'tablet',
    description:
      'The ultimate iPad. The M5 chip and an Ultra Retina XDR display in an impossibly thin design.\n\nSealed box, genuine Apple product.',
    descriptionNe: 'सबैभन्दा उत्कृष्ट आईप्याड। M5 चिप र Ultra Retina XDR डिस्प्ले, निकै पातलो डिजाइनमा।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['ipad', 'pro', 'tablet', 'apple'],
    tierName: 'Storage',
    tiers: [
      { value: '256GB', price: 169999 },
      { value: '512GB', price: 199999 },
    ],
    colours: [
      { value: 'Space Black', swatch: '#2b2b2d' },
      { value: 'Silver', swatch: '#e2e3e5' },
    ],
  },
  {
    name: 'Apple Watch Series 11',
    slug: 'apple-watch-series-11',
    category: 'watch',
    kind: 'watch',
    featured: true,
    description:
      'Your health on your wrist. Sleep score, heart and fitness tracking and a bright Always-On Retina display, with all-day battery life.\n\nSealed box, genuine Apple product. Works with iPhone.',
    descriptionNe: 'स्वास्थ्य तपाईंको नाडीमा। निद्रा, मुटु र व्यायामको हिसाब, सधैं देखिने डिस्प्ले र दिनभर चल्ने ब्याट्री।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान। आईफोनसँग चल्छ।',
    tags: ['watch', 'apple watch', 'health', 'apple'],
    tierName: 'Size',
    tiers: [
      { value: '42mm', price: 64999 },
      { value: '46mm', price: 69999 },
    ],
    colours: [
      { value: 'Rose Gold', swatch: '#e7c4b6' },
      { value: 'Jet Black', swatch: '#1f1f21' },
      { value: 'Silver', swatch: '#dcdde0' },
      { value: 'Space Grey', swatch: '#6d6e72' },
    ],
  },
  {
    name: 'Apple Watch Ultra 3',
    slug: 'apple-watch-ultra-3',
    category: 'watch',
    kind: 'watch',
    style: 'ultra',
    description:
      'Built for adventure. A rugged 49mm titanium case, the biggest Apple Watch display and the longest battery life of any Apple Watch.\n\nSealed box, genuine Apple product. Works with iPhone.',
    descriptionNe: 'साहसिक यात्राका लागि बनाइएको। ४९mm टाइटानियम केस, ठूलो डिस्प्ले र लामो ब्याट्री।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान। आईफोनसँग चल्छ।',
    tags: ['watch', 'apple watch', 'ultra', 'apple'],
    tierName: 'Size',
    tiers: [{ value: '49mm', price: 134999 }],
    colours: [
      { value: 'Natural Titanium', swatch: '#c8c2b5' },
      { value: 'Black Titanium', swatch: '#2b2b2d' },
    ],
  },
  {
    name: 'AirPods Pro 3',
    slug: 'airpods-pro-3',
    category: 'airpods',
    kind: 'airpods',
    style: 'pro',
    featured: true,
    description:
      'Active Noise Cancellation, Adaptive Audio and heart-rate sensing during workouts, in a comfortable fit that stays put.\n\nSealed box, genuine Apple product.',
    descriptionNe: 'आवाज रोक्ने सुविधा, Adaptive Audio र व्यायाम गर्दा मुटुको धड्कन नाप्ने, कानमा आरामसँग अड्किने।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['airpods', 'earbuds', 'audio', 'apple'],
    tiers: [{ value: 'Standard', price: 44999 }],
    colours: WHITE,
  },
  {
    name: 'AirPods 4 with Active Noise Cancellation',
    slug: 'airpods-4-anc',
    category: 'airpods',
    kind: 'airpods',
    style: 'standard',
    description: 'The open-fit AirPods, now with Active Noise Cancellation and a USB-C charging case.\n\nSealed box, genuine Apple product.',
    descriptionNe: 'खुला फिट भएका एयरपड्स, अब आवाज रोक्ने सुविधा र USB-C चार्जिङ केससहित।\n\nसिल गरिएको बाकस, सक्कली एप्पल सामान।',
    tags: ['airpods', 'earbuds', 'audio', 'apple'],
    tiers: [{ value: 'Standard', price: 27999 }],
    colours: WHITE,
  },
  {
    name: '20W USB-C Power Adapter',
    slug: 'apple-20w-usb-c-power-adapter',
    category: 'accessories',
    kind: 'adapter',
    description: 'Fast, efficient charging for iPhone, iPad and AirPods. Genuine Apple adapter.',
    descriptionNe: 'आईफोन, आईप्याड र एयरपड्सका लागि छिटो चार्ज गर्ने। सक्कली एप्पल एडाप्टर।',
    tags: ['charger', 'adapter', 'usb-c', 'accessories'],
    tiers: [{ value: 'Standard', price: 3499 }],
    colours: WHITE,
  },
  {
    name: 'MagSafe Charger (1 m)',
    slug: 'apple-magsafe-charger-1m',
    category: 'accessories',
    kind: 'magsafe',
    description: 'Snaps on magnetically for faster wireless charging of iPhone and AirPods. Genuine Apple accessory.',
    descriptionNe: 'चुम्बकले टाँसिने वायरलेस चार्जर, आईफोन र एयरपड्सका लागि। सक्कली एप्पल सामान।',
    tags: ['charger', 'magsafe', 'wireless', 'accessories'],
    tiers: [{ value: 'Standard', price: 7499 }],
    colours: WHITE,
  },
  {
    name: 'USB-C Woven Charge Cable (1 m)',
    slug: 'apple-usb-c-woven-cable-1m',
    category: 'accessories',
    kind: 'cable',
    description: 'A durable woven USB-C cable for charging and syncing iPhone, iPad and Mac. Genuine Apple accessory.',
    descriptionNe: 'आईफोन, आईप्याड र म्याक चार्ज गर्न टिकाउ बुनिएको USB-C केबल। सक्कली एप्पल सामान।',
    tags: ['cable', 'usb-c', 'accessories'],
    tiers: [{ value: 'Standard', price: 2999 }],
    colours: WHITE,
  },
  {
    name: 'iPhone 17 Pro Clear Case with MagSafe',
    slug: 'iphone-17-pro-clear-case-magsafe',
    category: 'accessories',
    kind: 'case',
    description: 'Shows off your iPhone colour while protecting it. Built-in magnets for MagSafe chargers and accessories.',
    descriptionNe: 'आईफोनको रङ देखाउँदै सुरक्षा दिने पारदर्शी केस। MagSafe चार्जरका लागि भित्रै चुम्बक।',
    tags: ['case', 'magsafe', 'iphone', 'accessories'],
    tiers: [{ value: 'Standard', price: 7999 }],
    colours: [{ value: 'Clear', swatch: '#dfe7ef' }],
  },
];

const colourSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export const photoPath = (slug: string, colour: string, back = false) =>
  `${BRAND}/products/${slug}-${colourSlug(colour)}${back ? '-back' : ''}.svg`;

export async function seedKangaroo({ resetSettings = false } = {}) {
  const store = await prisma.store.upsert({
    where: { slug: KANGAROO_SLUG },
    update: resetSettings ? { settings: KANGAROO_SETTINGS } : {},
    create: { slug: KANGAROO_SLUG, name: 'Kangaroo Mobile Zone', settings: KANGAROO_SETTINGS },
  });

  const categoryId = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const translations = { ne: { name: c.ne } };
    const row = await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: c.slug } },
      update: { translations },
      create: { storeId: store.id, slug: c.slug, name: c.name, sortOrder: i + 1, translations },
    });
    categoryId.set(c.slug, row.id);
  }

  // Created last-to-first, so the flagships at the top of the list are the "newest"
  // and lead the home page and the default sort.
  for (const [pi, p] of [...KANGAROO_CATALOGUE.entries()].reverse()) {
    const exists = await prisma.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug: p.slug } } });
    const translations = { ne: { description: p.descriptionNe } };
    if (exists) {
      if (resetSettings) await prisma.product.update({ where: { id: exists.id }, data: { translations, description: p.description } });
      continue;
    }

    const options = [
      ...(p.tierName ? [{ name: p.tierName, values: p.tiers.map((t) => ({ value: t.value })) }] : []),
      { name: 'Colour', values: p.colours },
    ];
    const variants = p.colours.flatMap((c, ci) =>
      p.tiers.map((t, ti) => ({
        options: { ...(p.tierName ? { [p.tierName]: t.value } : {}), Colour: c.value },
        price: toPaisa(t.price),
        compareAtPrice: t.compareAt ? toPaisa(t.compareAt) : undefined,
        wholesalePrice: toPaisa(Math.round(t.price * 0.9)),
        // A few combinations sold out or nearly gone, so the shop looks real.
        stock: (pi + ci * 2 + ti * 3) % 6,
      })),
    );
    const images = p.colours.flatMap((c) => [
      { url: photoPath(p.slug, c.value), alt: `${p.name} in ${c.value}`, width: 800, height: 1000, option: { name: 'Colour', value: c.value } },
      ...(p.kind === 'phone'
        ? [{ url: photoPath(p.slug, c.value, true), alt: `${p.name} in ${c.value}, back`, width: 800, height: 1000, option: { name: 'Colour', value: c.value } }]
        : []),
    ]);

    await createProduct(store.id, {
      name: p.name,
      slug: p.slug,
      description: p.description,
      status: 'ACTIVE',
      isFeatured: p.featured ?? false,
      categoryId: categoryId.get(p.category),
      tags: p.tags,
      translations,
      options,
      variants,
      images,
    });
    console.log(`  + ${p.name}`);
  }

  return store;
}
