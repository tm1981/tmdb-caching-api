import { globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextVitals,
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'app/generated/**',
    'next-env.d.ts',
  ]),
]

export default eslintConfig
