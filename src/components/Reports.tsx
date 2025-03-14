import React from 'react';
import Header from '../components/Header';
import '../../styles/home-page.css';

const reports = [
  {
    title: 'AI in Telecom',
    description: 'A comprehensive look at how AI is transforming the telecom industry.',
    link: 'https://example.com/ai-telecom-report',
  },
  {
    title: '5G Deployment Strategies',
    description: 'Insights into best practices for rolling out 5G networks.',
    link: 'https://example.com/5g-strategies-report',
  },
  {
    title: 'Cybersecurity in Wireless Networks',
    description: 'Understanding the evolving landscape of security threats in wireless networks.',
    link: 'https://example.com/cybersecurity-report',
  },
];

const TechnologyReports: React.FC = () => {
  return (
    <div className="home-page authenticated">
      <Header />
      <div className="content-container">
        <div className="grid-layout">
          {reports.map((report, index) => (
            <div key={index} className={`card ${index % 2 === 0 ? 'odd-card' : 'even-card'}`}>
              <div className="card-text">
                <h2>{report.title}</h2>
                <p>{report.description}</p>
                <button className="home-button" onClick={() => window.open(report.link, '_blank')}>
                  View Report
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <footer className="footer">
        <p>&copy; 2025 Symphony Towers Infrastructure. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default TechnologyReports;
