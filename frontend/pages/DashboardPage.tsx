import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Event } from '../types';
import { getEventsByOwner, createEvent, deleteEvent } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import Input from '../components/Input';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user) {
      getEventsByOwner().then(data => {
        setEvents(data);
        setLoading(false);
      });
    }
  }, [user]);

  const handleCreateEvent = async () => {
    if (!user || !newEventName.trim()) return;
    setIsCreating(true);
    try {
      const newEvent = await createEvent({
        name: newEventName,
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        closeTime: '17:00'
      });
      if (newEvent) {
        setEvents(prev => [...prev, newEvent]);
        setIsModalOpen(false);
        setNewEventName('');
        navigate(`/event/${newEvent.id}`);
      }
    } catch (error) {
      console.error("Failed to create event", error);
      // Here you would show an error toast
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    const success = await deleteEvent(eventId);
    if (success) {
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } else {
      alert('Failed to delete event.');
    }
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.username}!</h1>
        <Button onClick={() => setIsModalOpen(true)}>Create Event</Button>
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your Events</h2>
      
      {events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => (
            <Card key={event.id} className="hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold mb-2">{event.name}</h3>
              <p className="text-gray-600 mb-4 h-16 overflow-hidden">{event.description || 'No description provided.'}</p>
              <div className="flex justify-end space-x-2">
                <Link to={`/results/${event.id}`}>
                  <Button variant="secondary">View Results</Button>
                </Link>
                <Link to={`/event/${event.id}`}>
                  <Button>View Details</Button>
                </Link>
                <Button variant="danger" onClick={() => handleDeleteEvent(event.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">You haven't created any events yet.</p>
          <Button onClick={() => setIsModalOpen(true)} className="mt-4">Create Your First Event</Button>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Event">
        <div className="space-y-4">
          <Input 
            label="Event Name"
            id="event-name"
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            placeholder="e.g., Annual Hackathon"
          />
          <div className="flex justify-end">
            <Button onClick={handleCreateEvent} isLoading={isCreating} disabled={!newEventName.trim()}>
              Create and Configure
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardPage;
