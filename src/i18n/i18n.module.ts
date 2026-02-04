import { Module } from '@nestjs/common';
import { I18nModule, I18nJsonLoader, I18nOptions } from 'nestjs-i18n';
import { join } from 'path';

// Determine the correct path based on whether we're in development or production
const isDevelopment = process.env.NODE_ENV !== 'production';
const i18nPath = isDevelopment 
  ? join(__dirname, '../i18n/')  // For development
  : join(__dirname, './i18n/');   // For production build

const i18nOptions: I18nOptions = {
  fallbackLanguage: 'en',
  loader: I18nJsonLoader,
  loaderOptions: {
    path: i18nPath,
    watch: true,
  },
  // Enable language detection from Accept-Language header
  fallbacks: {
    'en': 'en',
    'zh': 'zh',
    'zh-CN': 'zh',
    'zh-TW': 'zh-Hant',
    'ja': 'ja',
    'ko': 'ko',
    'it': 'it',
    'de': 'de',
    'fr': 'fr',
    'ar': 'ar',
    'ru': 'ru',
  },
  resolvers: [], // Add an empty array of resolvers to prevent the warning
};

@Module({
  imports: [
    I18nModule.forRoot(i18nOptions),
  ],
  exports: [I18nModule],
})
export class AppI18nModule {}
