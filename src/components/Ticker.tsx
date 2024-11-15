import React from 'react';
import '../../styles/ticker.css';

const Ticker: React.FC = () => {
  return (
    <div className="ticker-wrap">
      <div className="ticker">
        <div className="ticker__item">- Food Drive is happening from 11/4-11/15!</div>
        <div className="ticker__item">- New Salesforce Workflow releasing in December</div>
        <div className="ticker__item">- Symphony Happy Hour at Hudson Grille on 11/13</div>
        <div className="ticker__item">- Wear your favorite team's jersey on 11/14!</div>
        <div className="ticker__item">- RSVP for the Holiday Party on 12/5!</div>
        <div className="ticker__item">- Fill out your personal goal sheet for 2025</div>
      </div>
    </div>
  );
};

export default Ticker;