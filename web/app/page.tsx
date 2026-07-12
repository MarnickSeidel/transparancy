import type { Metadata } from "next";

import HomePage from "@/app/components/HomePage";
import { homeMetadata } from "@/lib/seo";

export const metadata: Metadata = homeMetadata();

export default function Page() {
  return <HomePage />;
}
