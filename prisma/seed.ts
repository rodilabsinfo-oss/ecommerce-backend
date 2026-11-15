/**
 * Development data: one shop, a few categories, one supplier and some
 * garments with size × colour variants. Safe to run more than once.
 */
import 'dotenv/config';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';
import { toPaisa } from '../src/lib/money.js';
import { createProduct } from '../src/modules/catalog/product.service.js';

const SIZES = ['S', 'M', 'L', 'XL'];

/** Demo shop look and contact details (fake numbers). */
const DEMO_SETTINGS = {
  theme: {
    preset: 'atelier',
    colorMode: 'system',
    heroTitle: 'Dressed for every day, made for you',
    heroSubtitle: 'Kurtas, tops and shirts delivered all over Nepal. Pay cash when it arrives.',
  },
  contact: { phone: '9800000000', whatsapp: '9779800000000', email: 'hello@example.com', address: 'Kathmandu, Nepal' },
  social: { facebook: 'https://facebook.com', instagram: 'https://instagram.com', tiktok: 'https://tiktok.com' },
  translations: {
    ne: {
      heroTitle: 'हरेक दिन लगाउन मिल्ने, तपाईंकै लागि',
      heroSubtitle: 'कुर्ता, टप र सर्ट नेपालभर घरमै पुर्‍याउँछौं। सामान हातमा आएपछि मात्र पैसा तिर्नुहोस्।',
    },
  },
  payments: { enabled: ['COD'] },
  shipping: { flatFee: 10000, freeAbove: 300000 },
};
/** Placeholder photo in the garment's colour, with its name on it. */
function photo(name: string, colour: string, swatch: string, view: string) {
  const hex = swatch.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const text = r! * 0.299 + g! * 0.587 + b! * 0.114 > 160 ? '111111' : 'ffffff';
  const label = encodeURIComponent(`${name}\n${colour} · ${view}`);
  return `https://placehold.co/800x1000/${hex}/${text}/png?text=${label}`;
}

async function upsertCategory(
  storeId: string,
  slug: string,
  name: string,
  nameNe: string,
  parentId?: string,
  sortOrder = 0,
) {
  const translations = { ne: { name: nameNe } };
  return prisma.category.upsert({
    where: { storeId_slug: { storeId, slug } },
    update: { translations },
    create: { storeId, slug, name, parentId, sortOrder, translations },
  });
}

/** Every size × colour combination with the same price. */
function allVariants(
  colours: { value: string; swatch: string }[],
  price: number,
  wholesale: number,
  compareAt?: number,
) {
  return colours.flatMap((c) =>
    SIZES.map((s, i) => ({
      options: { Size: s, Colour: c.value },
      price: toPaisa(price),
      compareAtPrice: compareAt ? toPaisa(compareAt) : undefined,
      wholesalePrice: toPaisa(wholesale),
      stock: (i * 3 + c.value.length) % 7, // some sizes sold out on purpose
    })),
  );
}

async function main() {
  const store = await prisma.store.upsert({
    where: { slug: 'main' },
    update: process.env.SEED_RESET_SETTINGS ? { settings: DEMO_SETTINGS } : {},
    create: {
      slug: 'main',
      name: 'Demo Clothing Store',
      settings: DEMO_SETTINGS,
    },
  });

  const women = await upsertCategory(store.id, 'women', 'Women', 'महिला', undefined, 1);
  const men = await upsertCategory(store.id, 'men', 'Men', 'पुरुष', undefined, 2);
  const kurtas = await upsertCategory(store.id, 'kurtas', 'Kurtas', 'कुर्ता', women.id);
  const tops = await upsertCategory(store.id, 'tops', 'Tops', 'टप', women.id);
  const shirts = await upsertCategory(store.id, 'shirts', 'Shirts', 'सर्ट', men.id);
  const tshirts = await upsertCategory(store.id, 't-shirts', 'T-Shirts', 'टी-सर्ट', men.id);

  const supplier =
    (await prisma.supplier.findFirst({ where: { storeId: store.id, name: 'Garment Supplier' } })) ??
    (await prisma.supplier.create({ data: { storeId: store.id, name: 'Garment Supplier', phone: '9800000000' } }));

  const products = [
    {
      name: 'Cotton Printed Kurta',
      nameNe: 'प्रिन्टेड सुती कुर्ता',
      slug: 'cotton-printed-kurta',
      categoryId: kurtas.id,
      colours: [
        { value: 'Maroon', swatch: '#7b1e3a' },
        { value: 'Navy', swatch: '#1f2a44' },
      ],
      price: 2450,
      wholesale: 1500,
      compareAt: 2990,
      featured: true,
      tags: ['kurta', 'cotton', 'festive'],
    },
    {
      name: 'Rayon Straight Kurta',
      nameNe: 'रेयन स्ट्रेट कुर्ता',
      slug: 'rayon-straight-kurta',
      categoryId: kurtas.id,
      colours: [{ value: 'Mustard', swatch: '#d4a017' }],
      price: 1890,
      wholesale: 1100,
      tags: ['kurta', 'rayon'],
    },
    {
      name: 'Puff Sleeve Crop Top',
      nameNe: 'पफ बाहुला क्रप टप',
      slug: 'puff-sleeve-crop-top',
      categoryId: tops.id,
      colours: [
        { value: 'White', swatch: '#ffffff' },
        { value: 'Black', swatch: '#111111' },
      ],
      price: 1290,
      wholesale: 700,
      tags: ['top', 'casual'],
    },
    {
      name: 'Linen Casual Shirt',
      nameNe: 'लिनेन क्याजुअल सर्ट',
      slug: 'linen-casual-shirt',
      categoryId: shirts.id,
      colours: [
        { value: 'Sky Blue', swatch: '#87ceeb' },
        { value: 'Beige', swatch: '#d8c3a5' },
      ],
      price: 2190,
      wholesale: 1300,
      compareAt: 2590,
      featured: true,
      tags: ['shirt', 'linen'],
    },
    {
      name: 'Oversized Graphic T-Shirt',
      nameNe: 'ओभरसाइज ग्राफिक टी-सर्ट',
      slug: 'oversized-graphic-t-shirt',
      categoryId: tshirts.id,
      colours: [
        { value: 'Black', swatch: '#111111' },
        { value: 'Olive', swatch: '#556b2f' },
      ],
      price: 990,
      wholesale: 550,
      tags: ['tshirt', 'streetwear'],
    },
  ];

  for (const p of products) {
    const exists = await prisma.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug: p.slug } } });
    const translations = { ne: { name: p.nameNe, description: `${p.nameNe}। लगाउन सजिलो, हरेक दिनका लागि आरामदायी।` } };
    if (exists) {
      if (process.env.SEED_RESET_SETTINGS) await prisma.product.update({ where: { id: exists.id }, data: { translations } });
      continue;
    }

    await createProduct(store.id, {
      name: p.name,
      slug: p.slug,
      description: `${p.name}. Comfortable, everyday fit.`,
      status: 'ACTIVE',
      isFeatured: p.featured ?? false,
      categoryId: p.categoryId,
      supplierId: supplier.id,
      tags: p.tags,
      translations,
      options: [
        { name: 'Size', values: SIZES.map((value) => ({ value })) },
        { name: 'Colour', values: p.colours },
      ],
      variants: allVariants(p.colours, p.price, p.wholesale, p.compareAt),
      images: p.colours.flatMap((c) => [
        { url: photo(p.name, c.value, c.swatch, 'Front'), option: { name: 'Colour', value: c.value } },
        { url: photo(p.name, c.value, c.swatch, 'Back'), option: { name: 'Colour', value: c.value } },
      ]),
    });
    console.log(`  + ${p.name}`);
  }

  // Demo owner for development only. Use 'npm run staff:create' for real accounts.
  if (process.env.NODE_ENV !== 'production') {
    const email = 'owner@demo.local';
    const exists = await prisma.staffUser.findUnique({ where: { storeId_email: { storeId: store.id, email } } });
    if (!exists) {
      await prisma.staffUser.create({
        data: { storeId: store.id, email, name: 'Demo Owner', role: 'OWNER', passwordHash: await hashPassword('demo-owner-123') },
      });
      console.log('  + demo owner: owner@demo.local / demo-owner-123 (development only)');
    }
  }

  console.log(`Store ready: ${store.name} (${store.slug})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
