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
	CORS_ALLOW_ORIGIN: Joi.string(),
	//
	API_PUBLICATION_MAIL_TO: Joi.string(),
	// identity
	IDENTITY_ISSUER: Joi.string(),
	IDENTITY_CLIENT_ID: Joi.string(),
	IDENTITY_CLIENT_SECRET: Joi.string(),
	IDENTITY_AUTHORIZATION_URL: Joi.string(),
	IDENTITY_TOKEN_URL: Joi.string(),
	IDENTITY_CALLBACK_URL: Joi.string(),
	IDENTITY_USER_INFO_URL: Joi.string(),
	// auth bypass (dev only)
	AUTH_BYPASS: Joi.boolean(),
	// session
	SESSION_SECRET: Joi.string(),
	// cache
	REDIS_HOST: Joi.string(),
	REDIS_PORT: Joi.number(),
	REDIS_PASSWORD: Joi.string()
});
