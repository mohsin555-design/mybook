import tailwindcss from '@tailwindcss/vite'
import type { StorybookConfig } from '@storybook/react-vite'
import { mergeConfig } from 'vite'

function withoutPwaPlugins(plugins: NonNullable<StorybookConfig['viteFinal']> extends (config: infer Config) => unknown ? Config extends { plugins?: infer Plugins } ? Plugins : never : never) {
  if (!Array.isArray(plugins)) return plugins

  return plugins
    .map((plugin) => {
      if (Array.isArray(plugin)) return withoutPwaPlugins(plugin)
      return plugin
    })
    .filter((plugin) => {
      if (!plugin) return false
      if (Array.isArray(plugin)) return plugin.length > 0
      return !plugin.name?.startsWith('vite-plugin-pwa')
    })
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-designs'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  viteFinal: async (config) => {
    const plugins = withoutPwaPlugins(config.plugins)

    return mergeConfig({ ...config, plugins }, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          '@': new URL('../src', import.meta.url).pathname,
        },
      },
    })
  },
}

export default config
