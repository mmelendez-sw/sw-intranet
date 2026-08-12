/* Fallback when Amplify has not injected INTRANET_API_BASE_URL.
   Local: authConfig defaults to http://localhost:3001.
   Production: leave unset and use Amplify /api rewrite, OR set Amplify env
   INTRANET_API_BASE_URL so amplify.yml overwrites this file at build time. */
window.INTRANET_API_BASE_URL = window.INTRANET_API_BASE_URL || '';
