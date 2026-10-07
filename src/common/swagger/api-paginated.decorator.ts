import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/** 200 với `{ data: Model[], total, page, limit }` (xem `paginate` trong page-query.dto.ts). */
export const ApiPaginatedResponse = (model: Type<unknown>) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        type: 'object',
        required: ['data', 'total', 'page', 'limit'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          total: { type: 'integer', example: 42 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
        },
      },
    }),
  );
