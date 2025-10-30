import React from 'react';
import type { NavigationItem } from '../../types';
import homeIcon from '../../assets/images/home.svg';
import searchIcon from '../../assets/images/search.svg';
import plusIcon from '../../assets/images/plus.svg';
import messageIcon from '../../assets/images/message.svg';
import profileIcon from '../../assets/images/profile.svg';
import './BottomNavigation.css';

interface BottomNavigationProps {
  items: NavigationItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  items, 
  activeTab, 
  onTabChange 
}) => {
  return (
    <div className="bottom-navigation">
      {items.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => onTabChange(item.id)}
        >
          <div className="nav-icon">
            {getIconComponent(item.icon)}
          </div>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

const getIconComponent = (iconName: string) => {
  const iconMap: { [key: string]: string } = {
    home: homeIcon,
    search: searchIcon,
    create: plusIcon,
    messages: messageIcon,
    profile: profileIcon
  };
  
  const iconSrc = iconMap[iconName];
  
  if (!iconSrc) return <span>?</span>;
  
  return <img src={iconSrc} alt={iconName} className="nav-icon-img" />;
};

export default BottomNavigation;
