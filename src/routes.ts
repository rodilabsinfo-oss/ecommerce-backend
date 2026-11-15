import { Router } from 'express';
import { catalogRoutes } from './modules/catalog/catalog.routes.js';
import { resolveLang } from './lib/i18n.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { cartRoutes, orderRoutes } from './modules/orders/orders.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { resolveStore } from './modules/stores/store-context.js';
import { storeRoutes } from './modules/stores/store.routes.js';

export const routes = Router();

routes.use('/health', healthRoutes);

// Everything below belongs to a specific shop.
const v1 = Router();
v1.use(resolveStore);
v1.use(resolveLang);
v1.use('/store', storeRoutes);
v1.use('/payments', paymentRoutes);
v1.use('/cart', cartRoutes);
v1.use('/orders', orderRoutes);
v1.use('/admin', adminRoutes);
v1.use('/', catalogRoutes);

routes.use('/api/v1', v1);
