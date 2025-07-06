
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import TrophyIcon from '../components/icons/TrophyIcon';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError('');
    setLoading(true);
    try {
        const user = await auth.register(username, password);
        if (user) {
            navigate('/dashboard');
        } else {
            setError('Username may already be taken.');
        }
    } catch (err: any) {
        setError(err.message || 'Registration failed.');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center mb-8">
            <TrophyIcon className="h-12 w-12 mx-auto text-blue-600" />
            <h1 className="text-3xl font-extrabold text-gray-900 mt-4">Create Your Account</h1>
        </div>
      <Card className="w-full max-w-md">
        <form onSubmit={handleRegister} className="space-y-6">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <Input 
            label="Username" 
            id="username"
            type="text" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required 
          />
          <Input 
            label="Password" 
            id="password"
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          <Input 
            label="Confirm Password" 
            id="confirm-password"
            type="password" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required 
          />
          <Button type="submit" className="w-full" isLoading={loading}>Register</Button>
          <div className="text-sm text-center">
            <Link to="/" className="font-medium text-blue-600 hover:text-blue-500">
              Already have an account? Log in
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default RegisterPage;
