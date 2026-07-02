import React from 'react';
import '../../styles/department-page.css';
import { DepartmentConfig } from '../config/departments';
import { UserInfo } from '../types/user';
import IntranetSidebar from './IntranetSidebar';

interface DepartmentPageProps {
  userInfo: UserInfo;
  department: DepartmentConfig;
}

const DepartmentPage: React.FC<DepartmentPageProps> = ({ userInfo, department }) => {
  return (
    <div className="home-page department-page authenticated">
      <div className="content-container">
        <div className="main-content">
          <div className="department-updates-large-card">
            <div className="card odd-card">
              <div className="card-text">
                <h2>{department.label} Updates</h2>
                <ul />
              </div>
            </div>
          </div>

          <div className="department-resources-faq-container">
            <div className="card even-card blue-column department-small-card">
              <div className="card-text">
                <h2>{department.label} Resources</h2>
                <ul>
                  {department.resources.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card even-card blue-column department-small-card">
              <div className="card-text">
                <h2>FAQ</h2>
                <ul>
                  {department.faq.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <IntranetSidebar userInfo={userInfo} className="department-sidebar" />
      </div>
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
      </footer>
    </div>
  );
};

export default DepartmentPage;
