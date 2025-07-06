import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from './Button';
import TrophyIcon from './icons/TrophyIcon';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center text-blue-600 hover:text-blue-800">
               <TrophyIcon className="h-8 w-8 mr-2" />
              <span className="text-xl font-bold">SparkVote</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {user && <span className="text-gray-600 hidden sm:block">Welcome, {user.username}!</span>}
            <Button onClick={handleLogout} variant="secondary">
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
