import type { RequestHandler } from 'express';
import type { z } from 'zod';

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

/**
 * Validates request parts. Parsed values are stored on res.locals.input
 * (Express 5 makes req.query read-only).
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, res, next) => {
    res.locals.input = {
      body: schemas.body ? schemas.body.parse(req.body) : req.body,
      query: schemas.query ? schemas.query.parse(req.query) : req.query,
      params: schemas.params ? schemas.params.parse(req.params) : req.params,
    };
    next();
  };
