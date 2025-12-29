import React from 'react';
import './Card.css';

const Card = ({ 
  children, 
  className = '',
  padding = 'normal',
  hover = false,
  onClick,
  ...props 
}) => {
  const cardClass = [
    'card',
    `card--padding-${padding}`,
    hover ? 'card--hover' : '',
    onClick ? 'card--clickable' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass} onClick={onClick} {...props}>
      {children}
    </div>
  );
};

export default Card;
