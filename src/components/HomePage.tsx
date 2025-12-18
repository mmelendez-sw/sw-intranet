import React from 'react';
import '../../styles/home-page.css';
import { useAuth } from '../contexts/AuthContext';
import { homePageCards, sidebarSections } from '../data/homePageData';
import { Card } from './common/Card';
import { Button } from './common/Button';

const HomePage: React.FC = () => {
  const { userInfo } = useAuth();

  return (
    <div className={`home-page ${userInfo.isAuthenticated ? 'authenticated' : 'unauthenticated'}`}>
      {userInfo.isAuthenticated ? (
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: '6px', width: '100%' }}>
          {/* Main Content White Box */}
          <div className="content-container" style={{ border: 'none', borderRadius: '0', background: 'transparent', boxShadow: 'none', margin: '0 0 0px 10px', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, width: '100%', maxWidth: 'none' }}>
            <div className="main-content" style={{ flex: 1, width: '100%' }}>
              <div className="grid-layout" style={{ margin: '10px auto 10px auto', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '0', marginTop: '10px' }}>
                {homePageCards.map((card) => (
                  <Card key={card.id} variant={card.cardType}>
                    <img src={card.image} alt={card.imageAlt} className="card-image" />
                    <div className="card-text">
                      <h2>{card.title}</h2>
                      <ul>
                        {card.items.map((item, index) => (
                          <li key={index}>
                            {item.link ? (
                              <a href={item.link.url} target="_blank" rel="noopener noreferrer">
                                {item.link.text}
                              </a>
                            ) : (
                              item.text
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          {/* Sidebar White Box */}
          <aside className="sidebar sidebar-narrow" style={{ padding: '30px', minWidth: '250px', maxWidth: '280px', boxSizing: 'border-box', background: '#fff', border: 'none', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginLeft: '10px', marginTop: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column' }}>
              {sidebarSections.map((section) => {
                // Filter buttons based on elite status
                const visibleButtons = section.buttons?.filter(button => {
                  if (button.requiresElite) {
                    return userInfo.isEliteGroup;
                  }
                  // For Reports button, show elite version if user is elite, regular if not
                  if (section.id === 'quick-links' && button.label === 'Reports') {
                    return !userInfo.isEliteGroup; // Show regular Reports only if not elite
                  }
                  return true;
                });

                // Add elite Reports button if user is elite
                let buttonsToRender = visibleButtons || [];
                if (section.id === 'quick-links' && userInfo.isEliteGroup) {
                  const eliteReportsButton = section.buttons?.find(b => b.requiresElite && b.label === 'Elite Reports');
                  if (eliteReportsButton) {
                    buttonsToRender = [...(visibleButtons || []), eliteReportsButton];
                  }
                }

                return (
                  <section key={section.id} className={section.type} style={{ marginBottom: section.id === 'holiday-party-photos' ? '20px' : '20px', flexGrow: section.id === 'holiday-party-photos' ? 1 : undefined }}>
                    {section.title && <h2>{section.title}</h2>}
                    {section.content && <p>{section.content}</p>}
                    {buttonsToRender.map((button, index) => (
                      <Button
                        key={index}
                        variant="primary"
                        className="home-button"
                        onClick={() => window.open(button.url, button.openInNewTab ? '_blank' : '_self')}
                      >
                        {button.requiresElite && button.eliteLabel ? button.eliteLabel : button.label}
                      </Button>
                    ))}
                    {section.links && section.links.map((link, index) => (
                      <a key={index} href={link.url} target={link.openInNewTab ? '_blank' : '_self'} rel="noopener noreferrer">
                        {link.label}
                      </a>
                    ))}
                  </section>
                );
              })}
            </aside>
        </div>
      ) : (
        <div className="unauthenticated-message">
          <h2>Welcome to the Symphony Towers Infrastructure Intranet!</h2>
          <p>Please log in to access more features and content!</p>
        </div>
      )}
      <footer className="footer" style={{ marginTop: '10px' }}>
        <p>&copy; 2025 Symphony Towers Infrastructure. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;