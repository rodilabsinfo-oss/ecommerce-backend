import { Router } from 'express';
import { publicCache } from '../../lib/http-cache.js';
import { validate } from '../../middleware/validate.js';
import { getCategoryTree, getProductBySlug, listProducts } from './catalog.queries.js';
import { type ListProductsQuery, listProductsQuery, slugParams } from './catalog.schemas.js';

export const catalogRoutes = Router();


catalogRoutes.get('/categories', publicCache(), async (req, res) => {
  res.json({ data: await getCategoryTree(req.store.id) });
});

catalogRoutes.get('/products', publicCache(), validate({ query: listProductsQuery }), async (req, res) => {
  const query = res.locals.input.query as ListProductsQuery;
  res.json(await listProducts(req.store.id, query));
});

catalogRoutes.get('/products/:slug', publicCache(), validate({ params: slugParams }), async (req, res) => {
  const { slug } = res.locals.input.params as { slug: string };
  res.json({ data: await getProductBySlug(req.store.id, slug) });
});
