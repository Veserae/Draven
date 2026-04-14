import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Draven – Living New Tab Worlds',
    description: 'Transform every new tab into a dynamic, evolving living world that grows with your browsing.',
    version: '1.0.0',
    permissions: ['storage', 'tabs', 'activeTab', 'geolocation'],
    action: {
      default_title: 'Draven',
    },
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
  },
});
