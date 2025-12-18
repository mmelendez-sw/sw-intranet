import React from 'react';
import './Card.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'odd' | 'even';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  variant = 'odd' 
}) => {
  return (
    <div className={`card ${variant}-card ${className}`}>
      {children}
    </div>
  );
};

