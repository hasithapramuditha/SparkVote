import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import TrophyIcon from '../components/icons/TrophyIcon';

const LandingPage: React.FC = () => {
  const [voteCode, setVoteCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const user = await auth.login(username, password);
    setLoading(false);
    if (user) {
      navigate('/dashboard');
    } else {
      setError('Invalid username or password.');
    }
  };

  const handleVoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(voteCode.trim()) {
        navigate(`/vote/${voteCode.trim()}`);
    }
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center mb-10">
            <TrophyIcon className="h-16 w-16 mx-auto text-blue-600" />
            <h1 className="text-4xl font-extrabold text-gray-900 mt-4">Welcome to SparkVote</h1>
            <p className="text-lg text-gray-600 mt-2">The modern platform for fair and simple event voting.</p>
        </div>

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Vote by Code */}
        <Card className="lg:col-span-1">
            <h2 className="text-2xl font-bold text-center mb-1">Join an Event</h2>
            <p className="text-center text-gray-500 mb-6">Enter your voting code to start.</p>
          <form onSubmit={handleVoteSubmit} className="space-y-4">
            <Input 
              id="vote-code"
              placeholder="Your voting code"
              value={voteCode}
              onChange={(e) => setVoteCode(e.target.value)}
            />
            <Button type="submit" className="w-full">Submit</Button>
          </form>
        </Card>

        {/* Log In */}
        <Card className="lg:col-span-1">
            <h2 className="text-2xl font-bold text-center mb-6">Log In</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Input 
              id="username"
              label="Username" 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
            <Input 
              id="password"
              label="Password" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
            <Button type="submit" className="w-full" isLoading={loading}>Log In</Button>
          </form>
        </Card>

        {/* Register */}
        <Card className="lg:col-span-1 flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-center mb-4">New Here?</h2>
            <p className="text-center text-gray-500 mb-6">Create an account to host your own voting events.</p>
            <Link to="/register" className="w-full">
              <Button variant="secondary" className="w-full">
                Create Account
              </Button>
            </Link>
        </Card>

      </div>
    </div>
  );
};

export default LandingPage;
