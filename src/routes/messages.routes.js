import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';
import * as Ctrl from '../controllers/messages.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import messageValidators from '../validators/message.schema.js';

const r = Router();

r.post(
  '/',
  celebrate({ [Segments.BODY]: messageValidators.createBody }),
  asyncHandler(Ctrl.create)
);

r.get(
  '/',
  celebrate({ [Segments.QUERY]: messageValidators.listQuery }),
  asyncHandler(Ctrl.list)
);

r.get(
  '/:id',
  celebrate({ [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }) }),
  asyncHandler(Ctrl.getById)
);

r.patch(
  '/:id',
  celebrate({
    [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }),
    [Segments.BODY]: messageValidators.updateBody,
  }),
  asyncHandler(Ctrl.update)
);

r.delete(
  '/:id',
  celebrate({ [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }) }),
  asyncHandler(Ctrl.remove)
);

export default r;
