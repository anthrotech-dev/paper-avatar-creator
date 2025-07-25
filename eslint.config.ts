import react from 'eslint-plugin-react'
import globals from 'globals'
import { defineConfig } from 'eslint/config'

export default defineConfig([
    {
        plugins: { react },
        languageOptions: {
            globals: globals.browser,
            ecmaVersion: 'latest',
            sourceType: 'module',

            parserOptions: {
                project: ['tsconfig.json']
            }
        },
        rules: {}
    }
])
