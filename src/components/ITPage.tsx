import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/it-page.css';
import { UserInfo } from '../types/user';
import IntranetSidebar from './IntranetSidebar';

interface ITPageProps {
  userInfo: UserInfo;
}

const ITPage: React.FC<ITPageProps> = ({ userInfo }) => {
  const navigate = useNavigate();

  return (
    <div className="home-page technology-page authenticated">
      <div className="content-container">
        <div className="main-content">
          {/* Business Reports Button */}
          <div className="business-reports-button-container">
            <button
              className="home-button business-reports-button"
              onClick={() => navigate('/reports')}
            >
              Business Reports
            </button>
          </div>

          {/* Technology Updates - Large Card */}
          <div className="tech-updates-large-card">
            <div className="card odd-card">
              <div className="card-text">
                <h2>Technology Updates</h2>
                <ul>
                </ul>
              </div>
            </div>
          </div>

          {/* Technology Resources and FAQ - Two Smaller Cards */}
          <div className="tech-resources-faq-container">
            {/* Technology Resources Card */}
            <div className="card even-card blue-column tech-small-card">
              <div className="card-text">
                <h2>Technology Resources</h2>
                <ul>
                  <li>Software Downloads</li>
                  <li>Technology Policies &amp; Procedures</li>
                  <li>Helpful Guides</li>
                </ul>
              </div>
            </div>

            {/* FAQ Card */}
            <div className="card even-card blue-column tech-small-card">
              <div className="card-text">
                <h2>FAQ</h2>
                <ul>
                  <li>How do I reset my password?</li>
                  <li>Where can I download company software?</li>
                  <li>How do I contact Technology support?</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <IntranetSidebar userInfo={userInfo} className="technology-sidebar" />
      </div>
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ITPage;
