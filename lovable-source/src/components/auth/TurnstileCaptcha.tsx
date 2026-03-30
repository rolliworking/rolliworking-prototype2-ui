import { useEffect, useRef, useCallback } from 'react';

const TURNSTILE_SITE_KEY = '0x4AAAAAACL8eRGyi1lhu8Zy';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

interface TurnstileCaptchaProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export function TurnstileCaptcha({ onVerify, onError, onExpire }: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);
  const bypassedRef = useRef(false);

  const isPreviewDomain =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('lovableproject.com') ||
      window.location.hostname.startsWith('id-preview--') ||
      window.location.hostname.includes('--preview--') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname.startsWith('127.0.0.1'));

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;
    
    // Remove existing widget if any
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch (e) {
        // Widget might already be removed
      }
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: onVerify,
      'error-callback': onError,
      'expired-callback': onExpire,
      theme: 'auto',
      size: 'normal',
    });
  }, [onVerify, onError, onExpire]);

  useEffect(() => {
    // In Lovable preview (and localhost), Turnstile often shows "Invalid domain" unless configured.
    // We bypass to keep preview usable; published domains still use Turnstile normally.
    if (isPreviewDomain) {
      if (!bypassedRef.current) {
        bypassedRef.current = true;
        onVerify('bypass');
      }
      return;
    }

    // Check if script already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript && !scriptLoadedRef.current) {
      window.onTurnstileLoad = renderWidget;
      scriptLoadedRef.current = true;
      return;
    }

    if (scriptLoadedRef.current) return;

    // Load script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async = true;
    script.defer = true;

    window.onTurnstileLoad = renderWidget;
    scriptLoadedRef.current = true;

    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Widget might already be removed
        }
      }
    };
  }, [renderWidget, isPreviewDomain, onVerify]);

  if (isPreviewDomain) {
    return (
      <div className="my-4 text-center text-xs text-muted-foreground">
        Captcha disabled in preview.
      </div>
    );
  }

  return <div ref={containerRef} className="flex justify-center my-4" />;
}
