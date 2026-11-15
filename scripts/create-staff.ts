/**
 * Create (or reset) a staff account from the command line.
 *
 *   npm run staff:create -- --email owner@shop.com --name "Ram" --role OWNER --password "long-secret"
 *   (--store defaults to DEFAULT_STORE_SLUG)
 */
import { parseArgs } from 'node:util';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

const { values } = parseArgs({
  options: {
    store: { type: 'string', default: process.env.DEFAULT_STORE_SLUG ?? 'main' },
    email: { type: 'string' },
    name: { type: 'string', default: 'Owner' },
    role: { type: 'string', default: 'OWNER' },
    password: { type: 'string' },
  },
});

if (!values.email || !values.password || values.password.length < 8) {
  console.error('Usage: --email <email> --password <at least 8 chars> [--name] [--role OWNER|ADMIN|STAFF] [--store]');
  process.exit(1);
}
const role = values.role!.toUpperCase();
if (!['OWNER', 'ADMIN', 'STAFF'].includes(role)) throw new Error('role must be OWNER, ADMIN or STAFF');

const store = await prisma.store.findUniqueOrThrow({ where: { slug: values.store! } });
const email = values.email.toLowerCase();
const passwordHash = await hashPassword(values.password);
const staff = await prisma.staffUser.upsert({
  where: { storeId_email: { storeId: store.id, email } },
  update: { passwordHash, role: role as 'OWNER', isActive: true, name: values.name! },
  create: { storeId: store.id, email, name: values.name!, role: role as 'OWNER', passwordHash },
});
console.log(`Ready: ${staff.email} (${staff.role}) for ${store.name}`);
await prisma.$disconnect();
