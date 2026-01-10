import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { validationError } from '../utils/response';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(
  schema: ZodSchema,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    try {
      const data = target === 'body' ? req.body : target === 'query' ? req.query : req.params;
      const result = schema.parse(data);

      // Replace with validated and transformed data
      if (target === 'body') {
        req.body = result;
      } else if (target === 'query') {
        req.query = result;
      } else {
        req.params = result;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        error.errors.forEach((e) => {
          const path = e.path.join('.') || 'value';
          if (!details[path]) {
            details[path] = [];
          }
          details[path].push(e.message);
        });
        return validationError(res, details);
      }
      throw error;
    }
  };
}

// Validate multiple targets at once
export function validateAll(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const errors: Record<string, string[]> = {};

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      try {
        const data = target === 'body' ? req.body : target === 'query' ? req.query : req.params;
        const result = schema.parse(data);

        if (target === 'body') {
          req.body = result;
        } else if (target === 'query') {
          req.query = result;
        } else if (target === 'params') {
          req.params = result;
        }
      } catch (error) {
        if (error instanceof ZodError) {
          error.errors.forEach((e) => {
            const path = `${target}.${e.path.join('.')}` || target;
            if (!errors[path]) {
              errors[path] = [];
            }
            errors[path].push(e.message);
          });
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return validationError(res, errors);
    }

    next();
  };
}
