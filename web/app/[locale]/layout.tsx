import { notFound } from "next/navigation";

import { LOCALES, htmlLang, type Locale } from "@/lib/locale";
type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export default function LocaleLayout({ children, params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) notFound();

  return (
    <div lang={htmlLang(locale)} data-locale={locale}>
      {children}
    </div>
  );
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}
