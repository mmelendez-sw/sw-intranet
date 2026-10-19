/**
 * Interactive sign-in shared by the header button and the welcome page. Errors surface through
 * MSAL's LOGIN_FAILURE event (popup and redirect alike), which Header turns into the
 * Conditional Access banner.
 */
import type { IPublicClientApplication } from '@azure/msal-browser';
import { loginRequest } from '../authConfig';

// Returns true when an MSAL/AAD error is a Conditional Access block (e.g. the
// tenant requires Edge or device enrollment).
export const isConditionalAccessError = (error: any): boolean => {
  if (!error) return false;
  const msg = ((error.errorMessage || error.message) ?? '').toLowerCase();
  const code = (error.errorCode ?? '').toLowerCase();
  return (
    msg.includes('aadsts53003') ||
    msg.includes('aadsts530003') ||
    msg.includes('conditional access') ||
    msg.includes('microsoft edge') ||
    msg.includes('approved client app') ||
    msg.includes('app protection policy') ||
    (code === 'access_denied' && (msg.includes('policy') || msg.includes('compliance') || msg.includes('device')))
  );
};

export const isMobileSafari = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  /safari/i.test(navigator.userAgent) &&
  !/chrome|crios|fxios|edgios/i.test(navigator.userAgent);

// Brave does not include "Brave" in its user-agent string (it looks identical to
// Chrome), but it does expose navigator.brave. We check this to:
//   1. Guarantee Brave on Android always takes the redirect path even if a future
//      Brave build adds an Edge-like token to its UA.
//   2. Catch Brave on tablet or non-standard Android builds that don't include
//      "android" in the UA but still run without Edge's native identity broker.
const isBrave = (): boolean => !!(navigator as any).brave;

// True for any Android browser that lacks Microsoft Edge's native auth broker
// integration, including Chrome, Brave, Samsung Internet, Firefox for Android, etc.
// On these browsers, Chrome Custom Tabs intercept the post-Authenticator redirect
// and open it in a new session instead of returning to the original tab, so we
// skip the popup entirely and use a full-page redirect instead.
export const isAndroidNonEdge = (): boolean => {
  const ua = navigator.userAgent;
  const onAndroid = /android/i.test(ua);
  // Treat a browser as Edge only if the UA actually says so AND it is not Brave
  // (Brave is Chromium-based and could theoretically carry an Edge-style token).
  const isEdge = /edg(e|a)\//i.test(ua) && !isBrave();
  return (onAndroid || isBrave()) && !isEdge;
};

// Edge on iOS (EdgiOS) runs on WKWebView. WKWebView navigates popup windows to
// about:blank after a cross-origin redirect, so MSAL never receives the auth
// response from a loginPopup call. Skip popup entirely and use loginRedirect.
const isIOSEdge = (): boolean => /edgios/i.test(navigator.userAgent);

export async function startLogin(instance: IPublicClientApplication): Promise<void> {
  // On Android non-Edge: Chrome Custom Tabs intercept the Authenticator
  // redirect in a separate session, so the popup never returns.
  // On ALL iOS browsers (Safari, Edge, Chrome, etc.): Apple mandates WKWebView
  // for every third-party browser. WKWebView navigates popup windows to
  // about:blank after the cross-origin Microsoft redirect, so MSAL never
  // receives the auth response. Skip popup entirely for any iOS browser.
  if (isAndroidNonEdge() || isIOSEdge() || isMobileSafari()) {
    instance.loginRedirect(loginRequest).catch((e: any) => {
      if (!isConditionalAccessError(e)) console.error(e);
    });
    return;
  }

  try {
    await instance.loginPopup(loginRequest);
  } catch (e: any) {
    if (isConditionalAccessError(e)) return;
    // On mobile browsers (iOS Safari, in-app browsers) popups are often
    // blocked or get stuck when Authenticator is involved. Fall back to a
    // full-page redirect so the user can still authenticate.
    if (e.errorCode === 'popup_window_error' || e.errorCode === 'empty_window_error') {
      instance.loginRedirect(loginRequest).catch(console.error);
    } else {
      console.error(e);
    }
  }
}
