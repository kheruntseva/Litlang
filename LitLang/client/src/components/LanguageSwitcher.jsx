import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ru' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="px-3 py-1 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
    >
      {i18n.language === 'en' ? 'RU' : 'EN'}
    </button>
  );
}
