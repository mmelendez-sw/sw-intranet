import React from 'react';
import '../../styles/home-page.css';
import howBanner from '../../images/H.O.W.-banner.png';

// Power BI embed — disabled for /tv
// import { service, factories, models } from 'powerbi-client';
// import { PowerbiService, PowerbiEmbedToken } from '../services/powerbiService';

/**
 * Company Progress for /tv — Power BI embed commented out.
 * Salesforce gauges are intentionally disabled on this branch.
 */

// const powerbiEmbedService = new service.Service(
//   factories.hpmFactory,
//   factories.wpmpFactory,
//   factories.routerFactory
// );

const TvCompanyProgress: React.FC = () => {
  // const powerbiContainerRef = useRef<HTMLDivElement>(null);
  // const chartOverlayRef = useRef<HTMLDivElement>(null);
  // const [embedConfig, setEmbedConfig] = useState<PowerbiEmbedToken | null>(null);
  // const [embedError, setEmbedError] = useState<string | null>(null);

  // useEffect(() => {
  //   const container = powerbiContainerRef.current;
  //   if (!container) return;
  //   const preventZoom: EventListener = (e) => {
  //     if ((e instanceof WheelEvent && (e.ctrlKey || e.metaKey)) || e.type.startsWith('gesture')) {
  //       e.preventDefault();
  //     }
  //   };
  //   container.addEventListener('wheel', preventZoom, { passive: false });
  //   container.addEventListener('gesturestart', preventZoom as EventListener, { passive: false });
  //   container.addEventListener('gesturechange', preventZoom as EventListener, { passive: false });
  //   return () => {
  //     container.removeEventListener('wheel', preventZoom);
  //     container.removeEventListener('gesturestart', preventZoom as EventListener);
  //     container.removeEventListener('gesturechange', preventZoom as EventListener);
  //   };
  // }, [embedConfig]);

  // useEffect(() => {
  //   const overlay = chartOverlayRef.current;
  //   if (!overlay) return;
  //   const preventZoom = (e: WheelEvent | TouchEvent | MouseEvent) => {
  //     if ((e instanceof WheelEvent && (e.ctrlKey || e.metaKey)) || e.type.startsWith('gesture')) {
  //       e.preventDefault();
  //     }
  //   };
  //   overlay.addEventListener('wheel', preventZoom, { passive: false });
  //   overlay.addEventListener('gesturestart', preventZoom as EventListener, { passive: false });
  //   overlay.addEventListener('gesturechange', preventZoom as EventListener, { passive: false });
  //   return () => {
  //     overlay.removeEventListener('wheel', preventZoom);
  //     overlay.removeEventListener('gesturestart', preventZoom as EventListener);
  //     overlay.removeEventListener('gesturechange', preventZoom as EventListener);
  //   };
  // }, [embedConfig]);

  // useEffect(() => {
  //   let isActive = true;
  //   const loadEmbed = async () => {
  //     try {
  //       setEmbedError(null);
  //       const config = await PowerbiService.getInstance().generateEmbedToken();
  //       if (isActive) setEmbedConfig(config);
  //     } catch (error) {
  //       console.error('Failed to load Power BI embed config:', error);
  //       if (isActive) {
  //         setEmbedError(error instanceof Error ? error.message : 'Failed to load Power BI report.');
  //         setEmbedConfig(null);
  //       }
  //     }
  //   };
  //   loadEmbed();
  //   return () => {
  //     isActive = false;
  //   };
  // }, []);

  // useEffect(() => {
  //   const container = powerbiContainerRef.current;
  //   if (!container || !embedConfig) return;
  //   powerbiEmbedService.embed(container, {
  //     type: 'report',
  //     id: embedConfig.reportId,
  //     embedUrl: embedConfig.embedUrl,
  //     accessToken: embedConfig.token,
  //     tokenType:
  //       embedConfig.tokenType === 'Aad' ? models.TokenType.Aad : models.TokenType.Embed,
  //     settings: {
  //       filterPaneEnabled: false,
  //       navContentPaneEnabled: false,
  //       background: models.BackgroundType.Transparent,
  //       zoomLevel: 1.5,
  //     },
  //   });
  //   return () => {
  //     powerbiEmbedService.reset(container);
  //   };
  // }, [embedConfig]);

  return (
    <div className="home-page authenticated home-page-progress">
      <div className="home-page-progress-layout">
        <div className="content-container home-page-progress-container">
          <div className="main-content home-page-progress-main">
            <section className="homepage-hero" aria-label="Homepage banner">
              <img src={howBanner} alt="Homepage banner" className="homepage-hero-image" />
              <div className="homepage-hero-overlay">
                <h1 className="homepage-hero-title">
                  <span className="homepage-hero-line">
                    <span className="homepage-hero-acronym">H</span>
                    <span className="homepage-hero-rest">ighest standards</span>
                  </span>
                  <span className="homepage-hero-line">
                    <span className="homepage-hero-acronym">O</span>
                    <span className="homepage-hero-rest">ne team</span>
                  </span>
                  <span className="homepage-hero-line">
                    <span className="homepage-hero-acronym">W</span>
                    <span className="homepage-hero-rest">in!</span>
                  </span>
                </h1>
              </div>
            </section>

            {/* Power BI embed — disabled
            <div
              className="powerbi-embed-container"
              style={{
                width: '100%',
                maxWidth: 'none',
                height: '620px',
                margin: '0 auto',
                padding: 0,
                background: '#fff',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                alignItems: 'center',
              }}
            >
              {embedConfig ? (
                <>
                  <div
                    ref={powerbiContainerRef}
                    style={{
                      width: '100%',
                      height: '620px',
                      border: 'none',
                      borderRadius: '8px',
                      background: '#fff',
                    }}
                  />
                  <div
                    ref={chartOverlayRef}
                    style={{
                      position: 'absolute',
                      top: '320px',
                      left: 0,
                      width: '100%',
                      height: '300px',
                      zIndex: 2,
                      background: 'transparent',
                      pointerEvents: 'none',
                    }}
                  />
                </>
              ) : (
                <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>
                  {embedError || 'Loading PowerBI report...'}
                </div>
              )}
            </div>
            */}

            {/* Salesforce gauges — disabled on this branch
            <ProgressSection ... />
            */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TvCompanyProgress;
