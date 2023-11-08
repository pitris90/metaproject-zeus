import * as Joi from 'joi';

export const validationSchema = Joi.object({
	APPLICATION_MODE: Joi.string().valid('development', 'production', 'test')
});
