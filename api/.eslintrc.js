module.exports = {
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'import', 'unused-imports'],
	extends: [
		'plugin:@typescript-eslint/recommended',
		'plugin:prettier/recommended',
		'plugin:import/warnings',
		'plugin:import/typescript',
		'prettier'
	],
	root: true,
	env: {
		node: true,
		jest: true
	},
	ignorePatterns: ['docker/**', 'dist/**', 'node_modules/**'],
	rules: {
		'@typescript-eslint/interface-name-prefix': 'off',
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-use-before-define': 'error',
		'import/no-named-as-default': 0,
		'import/named': ['warn'],
		'import/imports-first': ['error', 'absolute-first'],
		'import/newline-after-import': ['warn', { count: 1 }],
		'import/no-deprecated': ['error'],
		'import/no-dynamic-require': ['warn'],
		'import/no-unused-modules': ['warn'],
		'import/order': ['warn'],
		'no-console': 'warn',
		'unused-imports/no-unused-imports': 'error'
	}
};
