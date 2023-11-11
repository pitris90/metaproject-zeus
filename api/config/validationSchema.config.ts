import * as Joi from 'joi';

export const validationSchema = Joi.object({
	APPLICATION_MODE: Joi.string().valid('development', 'production', 'test'),
	// database
	POSTGRES_HOST: Joi.string(),
	POSTGRES_PORT: Joi.number(),
	POSTGRES_USER: Joi.string(),
	POSTGRES_PASSWORD: Joi.string(),
	POSTGRES_DATABASE: Joi.string(),
	// CORS
	CORS_ALLOW_ORIGIN: Joi.string()
});
