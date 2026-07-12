"use client";

import AppHeader from "@/app/components/AppHeader";
import type { Lang } from "@/lib/i18n";
import type { NavKey } from "@/lib/navConfig";

type Props = {
  title: string;
  subtitle?: string;
  active: NavKey;
  lang: Lang;
  onToggleLang: () => void;
};

export default function SiteHeader(props: Props) {
  return <AppHeader variant="tool" {...props} />;
}
