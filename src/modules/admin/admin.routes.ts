import { Router } from 'express';
import { requireStaff } from '../auth/auth.middleware.js';
import { authRoutes } from '../auth/auth.routes.js';
import { categoryAdminRoutes } from './categories.admin.js';
import { orderAdminRoutes } from './orders.admin.js';
import {
  imageAdminRoutes,
  optionValueAdminRoutes,
  productAdminRoutes,
  variantAdminRoutes,
} from './products.admin.js';
import { customerAdminRoutes, dashboardAdminRoutes, settingsAdminRoutes, staffAdminRoutes } from './shop.admin.js';
import { payoutAdminRoutes, supplierAdminRoutes } from './suppliers.admin.js';

/**
 * Everything under /api/v1/admin. Sign-in is open; the rest needs a staff
 * session for this shop, and some parts need a higher role (see each router).
 */
export const adminRoutes = Router();

adminRoutes.use('/auth', authRoutes);

const secured = Router();
secured.use(requireStaff);
secured.use('/dashboard', dashboardAdminRoutes); // all staff
secured.use('/orders', orderAdminRoutes); // all staff
secured.use('/customers', customerAdminRoutes); // all staff
secured.use('/products', productAdminRoutes); // admin+
secured.use('/variants', variantAdminRoutes); // admin+
secured.use('/option-values', optionValueAdminRoutes); // admin+
secured.use('/images', imageAdminRoutes); // admin+
secured.use('/categories', categoryAdminRoutes); // admin+
secured.use('/suppliers', supplierAdminRoutes); // admin+
secured.use('/payouts', payoutAdminRoutes); // owner
secured.use('/settings', settingsAdminRoutes); // owner
secured.use('/staff', staffAdminRoutes); // owner

adminRoutes.use(secured);
