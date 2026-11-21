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
    heroSubtitle: 'New and checked used iPhones, iPad, Mac, Apple Watch, AirPods and phone accessories. Genuine products and expert setup. Visit us in Birtamode or order for delivery.',
  },
  translations: {
    ne: {
      heroEyebrow: 'कङ्गारु मोबाइल जोन · बिर्तामोड',
      heroTitle: 'नयाँ एप्पल, आजै तपाईंको हातमा।',
      heroSubtitle: 'नयाँ र जाँच गरिएका सेकेन्डह्यान्ड आईफोन, आईप्याड, म्याक, एप्पल वाच, एयरपड्स र फोन एक्सेसरिज। सक्कली सामान र सेटअपमा सहयोग। बिर्तामोडमा आउनुहोस् वा घरमै मगाउनुहोस्।',
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

/** Menu order. Children appear under their parent (Phone Accessories → Phone Cases, …). */
const CATEGORIES = [
  { slug: 'iphone', name: 'iPhone', ne: 'आईफोन' },
  { slug: 'used-phones', name: 'Used Phones', ne: 'सेकेन्डह्यान्ड फोन' },
  { slug: 'ipad', name: 'iPad', ne: 'आईप्याड' },
  { slug: 'mac', name: 'Mac', ne: 'म्याक' },
  { slug: 'watch', name: 'Watch', ne: 'एप्पल वाच' },
  { slug: 'airpods', name: 'AirPods', ne: 'एयरपड्स' },
  { slug: 'phone-accessories', name: 'Phone Accessories', ne: 'फोन एक्सेसरिज' },
  { slug: 'phone-cases', name: 'Phone Cases', ne: 'फोन कभर', parent: 'phone-accessories' },
  { slug: 'chargers-cables', name: 'Chargers & Cables', ne: 'चार्जर र केबल', parent: 'phone-accessories' },
  { slug: 'car-chargers', name: 'Car Chargers', ne: 'कार चार्जर', parent: 'phone-accessories' },
  { slug: 'speakers', name: 'Speakers', ne: 'स्पिकर', parent: 'phone-accessories' },
] as const;

type Colour = { value: string; swatch: string };
/** One storage / size choice and its price in rupees. */
type Tier = { value: string; price: number; compareAt?: number };
/** Used phones: condition grade and how much it changes the price, in rupees. */
type Condition = { value: string; delta: number };

export interface CatalogueItem {
  name: string;
  slug: string;
  category: (typeof CATEGORIES)[number]['slug'];
  /** Which drawing to use for the demo photo. */
  kind:
    | 'phone'
    | 'laptop'
    | 'tablet'
    | 'watch'
    | 'airpods'
    | 'adapter'
    | 'magsafe'
    | 'cable'
    | 'case'
    | 'carcharger'
    | 'speaker';
  style?: 'pro' | 'pro-classic' | 'air' | 'standard' | 'ultra' | 'silicone' | 'mount' | 'flip' | 'mini';
  description: string;
  descriptionNe: string;
  tags: string[];
  featured?: boolean;
  /** "Storage" for phones, iPads and Macs; "Size" for watches. Leave out when there is one version. */
  tierName?: 'Storage' | 'Size';
  tiers: Tier[];
  /** Used phones only: every tier comes in each condition. */
  conditions?: Condition[];
  colours: Colour[];
}

/** Sample grades for used phones. The shop can rename them or change prices in the staff desk. */
const USED_CONDITIONS: Condition[] = [
  { value: 'Excellent', delta: 0 },
  { value: 'Good', delta: -8000 },
];
const USED_TEXT =
  '\n\nChecked by Kangaroo before sale: Face ID, cameras, speakers, charging and battery health. Excellent: almost no marks, battery health 90% or more. Good: light marks, battery health 85% or more. Comes with a charging cable.';
const USED_TEXT_NE =
  '\n\nबेच्नुअघि कङ्गारुले जाँच गरेको: Face ID, क्यामेरा, स्पिकर, चार्जिङ र ब्याट्री हेल्थ। Excellent: खासै दाग छैन, ब्याट्री हेल्थ ९०% वा बढी। Good: हल्का दाग, ब्याट्री हेल्थ ८५% वा बढी। चार्जिङ केबलसहित।';

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
  // ── Used phones (sample stock) ────────────────────────────────────────
  {
    name: 'Used iPhone 15 Pro Max',
    slug: 'used-iphone-15-pro-max',
    category: 'used-phones',
    kind: 'phone',
    style: 'pro-classic',
    featured: true,
    description: 'Pre-owned iPhone 15 Pro Max: 6.7-inch display, A17 Pro chip, titanium design and a 5x telephoto camera.' + USED_TEXT,
    descriptionNe: 'प्रयोग भइसकेको iPhone 15 Pro Max: ६.७ इन्च डिस्प्ले, A17 Pro चिप, टाइटानियम डिजाइन र 5x टेलिफोटो क्यामेरा।' + USED_TEXT_NE,
    tags: ['iphone', 'used', 'second hand', 'pro'],
    tierName: 'Storage',
    tiers: [
      { value: '256GB', price: 139999 },
      { value: '512GB', price: 154999 },
    ],
    conditions: USED_CONDITIONS,
    colours: [
      { value: 'Natural Titanium', swatch: '#bdb6a9' },
      { value: 'Blue Titanium', swatch: '#3f4a5a' },
    ],
  },
  {
    name: 'Used iPhone 15 Pro',
    slug: 'used-iphone-15-pro',
    category: 'used-phones',
    kind: 'phone',
    style: 'pro-classic',
    description: 'Pre-owned iPhone 15 Pro: 6.1-inch display, A17 Pro chip, titanium design and USB-C.' + USED_TEXT,
    descriptionNe: 'प्रयोग भइसकेको iPhone 15 Pro: ६.१ इन्च डिस्प्ले, A17 Pro चिप, टाइटानियम डिजाइन र USB-C।' + USED_TEXT_NE,
    tags: ['iphone', 'used', 'second hand', 'pro'],
    tierName: 'Storage',
    tiers: [
      { value: '128GB', price: 114999 },
      { value: '256GB', price: 124999 },
    ],
    conditions: USED_CONDITIONS,
    colours: [
      { value: 'Black Titanium', swatch: '#3a3a3c' },
      { value: 'White Titanium', swatch: '#e8e6e1' },
    ],
  },
  {
    name: 'Used iPhone 14',
    slug: 'used-iphone-14',
    category: 'used-phones',
    kind: 'phone',
    style: 'standard',
    description: 'Pre-owned iPhone 14: 6.1-inch Super Retina XDR display, A15 Bionic chip and a dual-camera system.' + USED_TEXT,
    descriptionNe: 'प्रयोग भइसकेको iPhone 14: ६.१ इन्च डिस्प्ले, A15 Bionic चिप र दुईवटा क्यामेरा।' + USED_TEXT_NE,
    tags: ['iphone', 'used', 'second hand'],
    tierName: 'Storage',
    tiers: [
      { value: '128GB', price: 69999 },
      { value: '256GB', price: 77999 },
    ],
    conditions: USED_CONDITIONS,
    colours: [
      { value: 'Purple', swatch: '#d8cde3' },
      { value: 'Midnight', swatch: '#2f343b' },
    ],
  },
  {
    name: 'Used iPhone 13',
    slug: 'used-iphone-13',
    category: 'used-phones',
    kind: 'phone',
    style: 'standard',
    description: 'Pre-owned iPhone 13: 6.1-inch display, A15 Bionic chip and great battery life. A smart first iPhone.' + USED_TEXT,
    descriptionNe: 'प्रयोग भइसकेको iPhone 13: ६.१ इन्च डिस्प्ले, A15 Bionic चिप र राम्रो ब्याट्री। पहिलो आईफोनका लागि उत्तम।' + USED_TEXT_NE,
    tags: ['iphone', 'used', 'second hand', 'value'],
    tierName: 'Storage',
    tiers: [{ value: '128GB', price: 54999 }],
    conditions: USED_CONDITIONS,
    colours: [
      { value: 'Blue', swatch: '#2f5f7a' },
      { value: 'Pink', swatch: '#f3d3d4' },
    ],
  },
  // ── Phone accessories ─────────────────────────────────────────────────
  {
    name: 'iPhone 17 Pro Max Silicone Case with MagSafe',
    slug: 'iphone-17-pro-max-silicone-case-magsafe',
    category: 'phone-cases',
    kind: 'case',
    style: 'silicone',
    description: 'Soft-touch silicone outside, microfibre lining inside, and built-in magnets for MagSafe chargers and wallets.',
    descriptionNe: 'बाहिर नरम सिलिकन, भित्र माइक्रोफाइबर, र MagSafe चार्जर तथा वालेटका लागि चुम्बक।',
    tags: ['case', 'silicone', 'magsafe', 'iphone'],
    tiers: [{ value: 'Standard', price: 6999 }],
    colours: [
      { value: 'Black', swatch: '#2b2b2e' },
      { value: 'Navy', swatch: '#2e3a55' },
      { value: 'Sage', swatch: '#9fae95' },
    ],
  },
  {
    name: 'JBL Flip 6 Portable Speaker',
    slug: 'jbl-flip-6',
    category: 'speakers',
    kind: 'speaker',
    style: 'flip',
    description: 'Bold sound in a rugged, waterproof (IP67) body. Up to 12 hours of play on a charge, with Bluetooth to any phone.',
    descriptionNe: 'पानी नछिर्ने (IP67) बलियो बडीमा दमदार आवाज। एकपटक चार्जमा १२ घण्टासम्म, जुनसुकै फोनसँग ब्लुटुथ।',
    tags: ['speaker', 'bluetooth', 'jbl', 'audio'],
    tiers: [{ value: 'Standard', price: 15999 }],
    colours: [
      { value: 'Black', swatch: '#1f1f22' },
      { value: 'Blue', swatch: '#2b5fa8' },
      { value: 'Red', swatch: '#c8222c' },
    ],
  },
  {
    name: 'JBL Go 4 Mini Speaker',
    slug: 'jbl-go-4',
    category: 'speakers',
    kind: 'speaker',
    style: 'mini',
    description: 'Pocket-size speaker with surprisingly big sound. Waterproof and dustproof (IP67), with a loop to hang it anywhere.',
    descriptionNe: 'खल्तीमा अट्ने सानो स्पिकर, तर ठूलो आवाज। पानी र धुलो नछिर्ने (IP67), जहाँ पनि झुन्ड्याउन मिल्ने।',
    tags: ['speaker', 'bluetooth', 'jbl', 'audio'],
    tiers: [{ value: 'Standard', price: 5999 }],
    colours: [
      { value: 'Black', swatch: '#1f1f22' },
      { value: 'Blue', swatch: '#2b5fa8' },
      { value: 'Pink', swatch: '#e8a3b8' },
    ],
  },
  {
    name: 'Dual USB-C Fast Car Charger (45W)',
    slug: 'dual-usb-c-car-charger-45w',
    category: 'car-chargers',
    kind: 'carcharger',
    description: 'Charges two phones at full speed from your car socket. Fast-charges iPhone to 50% in about 30 minutes.',
    descriptionNe: 'गाडीको सकेटबाट दुईवटा फोन एकैसाथ छिटो चार्ज। आईफोन करिब ३० मिनेटमा ५०% सम्म।',
    tags: ['car charger', 'usb-c', 'charger', 'car'],
    tiers: [{ value: 'Standard', price: 2499 }],
    colours: [{ value: 'Black', swatch: '#232326' }],
  },
  {
    name: 'Magnetic Wireless Car Mount Charger',
    slug: 'magnetic-wireless-car-mount-charger',
    category: 'car-chargers',
    kind: 'carcharger',
    style: 'mount',
    description: 'Snaps your iPhone onto the air vent magnetically and charges it wirelessly while you drive. Works with MagSafe cases.',
    descriptionNe: 'चलाउँदा आईफोनलाई एसी भेन्टमा चुम्बकले टाँसेर वायरलेस चार्ज गर्छ। MagSafe केससँग चल्छ।',
    tags: ['car charger', 'magsafe', 'wireless', 'car', 'mount'],
    tiers: [{ value: 'Standard', price: 4999 }],
    colours: [{ value: 'Black', swatch: '#232326' }],
  },
  {
    name: '20W USB-C Power Adapter',
    slug: 'apple-20w-usb-c-power-adapter',
    category: 'chargers-cables',
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
    category: 'chargers-cables',
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
    category: 'chargers-cables',
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
    category: 'phone-cases',
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

  // The first version had a flat "Accessories" category. Rename it in place so its
  // products and links carry over to "Phone Accessories".
  const old = await prisma.category.findUnique({ where: { storeId_slug: { storeId: store.id, slug: 'accessories' } } });
  const renamed = await prisma.category.findUnique({ where: { storeId_slug: { storeId: store.id, slug: 'phone-accessories' } } });
  if (old && !renamed) {
    await prisma.category.update({ where: { id: old.id }, data: { slug: 'phone-accessories', name: 'Phone Accessories' } });
  }

  const categoryId = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const translations = { ne: { name: c.ne } };
    const parentId = 'parent' in c ? categoryId.get(c.parent) : undefined;
    const row = await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: c.slug } },
      update: { translations, ...(resetSettings ? { name: c.name, sortOrder: i + 1, parentId: parentId ?? null } : {}) },
      create: { storeId: store.id, slug: c.slug, name: c.name, sortOrder: i + 1, parentId, translations },
    });
    categoryId.set(c.slug, row.id);
  }

  // Created last-to-first, so the flagships at the top of the list are the "newest"
  // and lead the home page and the default sort.
  for (const [pi, p] of [...KANGAROO_CATALOGUE.entries()].reverse()) {
    const exists = await prisma.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug: p.slug } } });
    const translations = { ne: { description: p.descriptionNe } };
    if (exists) {
      if (resetSettings) {
        await prisma.product.update({
          where: { id: exists.id },
          data: { translations, description: p.description, categoryId: categoryId.get(p.category) },
        });
      }
      continue;
    }

    const options = [
      ...(p.tierName ? [{ name: p.tierName, values: p.tiers.map((t) => ({ value: t.value })) }] : []),
      ...(p.conditions ? [{ name: 'Condition', values: p.conditions.map((c) => ({ value: c.value })) }] : []),
      { name: 'Colour', values: p.colours },
    ];
    const grades = p.conditions ?? [undefined];
    const variants = p.colours.flatMap((c, ci) =>
      p.tiers.flatMap((t, ti) =>
        grades.map((g, gi) => {
          const price = t.price + (g?.delta ?? 0);
          return {
            options: {
              ...(p.tierName ? { [p.tierName]: t.value } : {}),
              ...(g ? { Condition: g.value } : {}),
              Colour: c.value,
            },
            price: toPaisa(price),
            compareAtPrice: t.compareAt ? toPaisa(t.compareAt) : undefined,
            wholesalePrice: toPaisa(Math.round(price * 0.9)),
            // A few combinations sold out or nearly gone, so the shop looks real.
            // Used phones are single pieces, so at most 2 of each.
            stock: g ? (pi + ci + ti + gi) % 3 : (pi + ci * 2 + ti * 3) % 6,
          };
        }),
      ),
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
