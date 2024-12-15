import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';
import _import from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all
});

export default [
	{
		ignores: ['docker/**/*', 'dist/**/*', 'node_modules/**/*', '**/node_modules/']
	},
	...fixupConfigRules(
		compat.extends(
			'plugin:@typescript-eslint/recommended',
			'plugin:prettier/recommended',
			'plugin:import/warnings',
			'plugin:import/typescript',
			'prettier'
		)
	),
	{
		plugins: {
			'@typescript-eslint': fixupPluginRules(typescriptEslintEslintPlugin),
			prettier: fixupPluginRules(prettier),
			import: fixupPluginRules(_import),
			'unused-imports': unusedImports
		},

		languageOptions: {
			globals: {
				...globals.node,
				...globals.jest
			},

			parser: tsParser
		},

		rules: {
			'@typescript-eslint/interface-name-prefix': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-use-before-define': 'error',
			'import/no-named-as-default': 0,
			'import/named': ['warn'],
			'import/imports-first': ['error', 'absolute-first'],

			'import/newline-after-import': [
				'warn',
				{
					count: 1
				}
			],

			'import/no-deprecated': ['error'],
			'import/no-dynamic-require': ['warn'],
			'import/no-unused-modules': ['warn'],
			'import/order': ['warn'],
			'no-console': 'warn',
			'unused-imports/no-unused-imports': 'error'
		}
	}
];
