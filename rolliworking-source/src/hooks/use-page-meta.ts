import { useEffect } from "react";

type PageMeta = {
  title: string;
  description?: string;
  canonicalPath?: string;
};

export function usePageMeta({ title, description, canonicalPath }: PageMeta) {
  useEffect(() => {
    document.title = title;

    if (description) {
      const el = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (el) el.content = description;
    }

    if (canonicalPath) {
      const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (link) link.href = new URL(canonicalPath, window.location.origin).toString();
    }
  }, [title, description, canonicalPath]);
}
