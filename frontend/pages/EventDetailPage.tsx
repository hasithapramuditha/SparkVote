import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Event, Group, Project } from '../types';
import { getEventById, updateEvent, addGroupToEvent, addProjectToEvent, addCriteriaToEvent, removeCriteriaFromEvent, removeGroupFromEvent, removeProjectFromEvent, openVoting, closeVoting } from '../services/api';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import UsersIcon from '../components/icons/UsersIcon';
import FolderIcon from '../components/icons/FolderIcon';
import CogIcon from '../components/icons/CogIcon';
import { useAuth } from '../hooks/useAuth';

type Tab = 'groups' | 'projects' | 'criteria' | 'settings';

const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('groups');
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<'addGroup' | 'addProject' | 'addCriteria' | null>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPassword, setNewGroupPassword] = useState('');
  
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const [newCriteriaName, setNewCriteriaName] = useState('');
  const [newCriteriaMaxScore, setNewCriteriaMaxScore] = useState(10);
  
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  const [votingCountdown, setVotingCountdown] = useState<string>('');
  const [votingStatus, setVotingStatus] = useState<string>('');

  const { user } = useAuth();

  const triedOpenVoting = useRef(false);

  const fetchEvent = useCallback(() => {
    if (eventId) {
      setLoading(true);
      getEventById(eventId).then(data => {
        setEvent(data);
        setLoading(false);
      });
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  useEffect(() => {
    if (!event) return;
    // Compute voting status and countdown
    const computeStatus = () => {
      const now = new Date();
      const start = new Date(`${event.date}T${event.startTime}`);
      const end = new Date(`${event.date}T${event.closeTime}`);
      let status = event.isVotingOpen === true ? 'open' : event.isVotingOpen === false ? 'closed' : (now < start ? 'upcoming' : (now >= start && now <= end ? 'open' : 'closed'));
      setVotingStatus(status);
      let countdown = '';
      if (status === 'upcoming') {
        const diff = start.getTime() - now.getTime();
        if (diff > 0) {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          countdown = `Voting opens in ${h}h ${m}m ${s}s`;
        }
      } else if (status === 'open') {
        const diff = end.getTime() - now.getTime();
        if (diff > 0) {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          countdown = `Voting closes in ${h}h ${m}m ${s}s`;
        }
      } else if (status === 'closed') {
        countdown = 'Voting is closed.';
      }
      setVotingCountdown(countdown);
    };
    computeStatus();
    const interval = setInterval(computeStatus, 1000);
    return () => clearInterval(interval);
  }, [event]);

  useEffect(() => {
    if (!event) return;
    const now = new Date();
    const start = new Date(`${event.date}T${event.startTime}`);
    const end = new Date(`${event.date}T${event.closeTime}`);
    const isOwner = event.ownerId === (user?.id || (typeof user === 'string' ? JSON.parse(user).id : undefined));
    // Only try to open voting once per page load
    if (
      isOwner &&
      now >= start &&
      now <= end &&
      event.isVotingOpen !== true &&
      !triedOpenVoting.current
    ) {
      triedOpenVoting.current = true;
      openVoting(event.id).then(() => {
        fetchEvent();
      });
    }
  }, [event, user]);

  const handleOpenModal = (type: 'addGroup' | 'addProject' | 'addCriteria') => {
    setModalContent(type);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalContent(null);
    setNewGroupName('');
    setNewGroupPassword('');
    setNewProjectName('');
    setNewProjectDescription('');
    setNewCriteriaName('');
    setNewCriteriaMaxScore(10);
  };

  const handleAddGroup = async () => {
    if (eventId && newGroupName) {
      await addGroupToEvent(eventId, { 
        name: newGroupName, 
        password: newGroupPassword.trim() || undefined
      });
      fetchEvent();
      handleCloseModal();
    }
  };

  const handleAddProject = async () => {
    if (eventId && newProjectName) {
      await addProjectToEvent(eventId, { name: newProjectName, description: newProjectDescription });
      fetchEvent();
      handleCloseModal();
    }
  };
  
  const handleAddCriteria = async () => {
    if (eventId && newCriteriaName) {
      const result = await addCriteriaToEvent(eventId, { 
        name: newCriteriaName, 
        maxScore: newCriteriaMaxScore
      });
      if (result) {
        await fetchEvent();
        handleCloseModal();
      } else {
        console.error('Failed to add criteria');
        // Optionally show error to user
      }
    }
  };

  const handleRemoveCriteria = async (index: number) => {
    if (eventId && window.confirm('Are you sure you want to remove this criteria?')) {
      await removeCriteriaFromEvent(eventId, index);
      fetchEvent();
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (event && eventId) {
      await updateEvent(eventId, event);
      // Show success message
    }
  };

  const handleManualOpenVoting = async () => {
    if (eventId) {
      await openVoting(eventId);
      fetchEvent();
    }
  };
  const handleManualCloseVoting = async () => {
    if (eventId) {
      await closeVoting(eventId);
      fetchEvent();
    }
  };

  if (loading) return <Spinner />;
  if (!event) return <div>Event not found.</div>;

  const renderModalContent = () => {
    if (modalContent === 'addGroup') {
      return (
        <div className="space-y-4">
          <Input label="Group Name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} required />
          <Input 
            label="Group Password (optional)" 
            type="password" 
            value={newGroupPassword} 
            onChange={e => setNewGroupPassword(e.target.value)} 
            placeholder="Leave blank for no password"
          />
          <Button onClick={handleAddGroup}>Add Group</Button>
        </div>
      );
    }
    if (modalContent === 'addProject') {
      return (
        <div className="space-y-4">
          <Input label="Project Name" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} />
          <div className="relative">
            <label htmlFor="proj-desc" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea id="proj-desc" value={newProjectDescription} onChange={e => setNewProjectDescription(e.target.value)} rows={4} className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          </div>
          <Button onClick={handleAddProject}>Add Project</Button>
        </div>
      );
    }
    if (modalContent === 'addCriteria') {
      return (
        <div className="space-y-4">
          <Input label="Criteria Name" value={newCriteriaName} onChange={e => setNewCriteriaName(e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Score</label>
            <input 
              type="number" 
              min="1" 
              max="100" 
              value={newCriteriaMaxScore} 
              onChange={e => setNewCriteriaMaxScore(parseInt(e.target.value) || 10)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <Button onClick={handleAddCriteria}>Add Criteria</Button>
        </div>
      );
    }
    return null;
  };

  const TabButton: React.FC<{ tab: Tab, icon: React.ReactNode, label: string }> = ({ tab, icon, label }) => (
    <button onClick={() => setActiveTab(tab)} className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md ${activeTab === tab ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
      <p className="text-gray-600 mb-6">Voting Code: <span className="font-mono bg-gray-200 px-2 py-1 rounded">{event.voteCode}</span></p>
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:space-x-6 space-y-2 md:space-y-0">
        <span className={`font-semibold ${votingStatus === 'open' ? 'text-green-600' : votingStatus === 'closed' ? 'text-red-600' : 'text-yellow-600'}`}>Voting Status: {votingStatus.charAt(0).toUpperCase() + votingStatus.slice(1)}</span>
        <span className="text-gray-500">{votingCountdown}</span>
        {/* Manual controls for owner */}
        {event.ownerId === localStorage.getItem('user') && (
          <div className="flex space-x-2">
            <Button onClick={handleManualOpenVoting} disabled={votingStatus === 'open'}>Open Voting</Button>
            <Button onClick={handleManualCloseVoting} disabled={votingStatus === 'closed'}>Close Voting</Button>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-4">
          <TabButton tab="groups" icon={<UsersIcon className="h-5 w-5"/>} label="Groups" />
          <TabButton tab="projects" icon={<FolderIcon className="h-5 w-5"/>} label="Projects" />
          <TabButton tab="criteria" icon={<CogIcon className="h-5 w-5"/>} label="Criteria" />
          <TabButton tab="settings" icon={<CogIcon className="h-5 w-5"/>} label="Settings" />
        </nav>
      </div>

      <div>
        {activeTab === 'groups' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Voter Groups</h2>
              <Button onClick={() => handleOpenModal('addGroup')}>Add Group</Button>
            </div>
            <div className="bg-white shadow rounded-lg">
              <ul className="divide-y divide-gray-200">
                {event.groups.map(group => (
                  <li key={group.id} className="px-6 py-4 flex justify-between items-center">
                    <span className="font-medium">{group.name}</span>
                    <div className="flex items-center gap-2">
                    {group.password && (
                      <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">Password Protected</span>
                    )}
                      <Button
                        variant="danger"
                        className="text-xs px-2 py-1"
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to remove this group?')) {
                            await removeGroupFromEvent(event.id, group.id);
                            fetchEvent();
                          }
                        }}
                      >Remove</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {activeTab === 'projects' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Projects</h2>
              <Button onClick={() => handleOpenModal('addProject')}>Add Project</Button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {event.projects.map(project => (
                    <div key={project.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                        <div>
                        <h3 className="font-bold text-lg">{project.name}</h3>
                        <p className="text-gray-600 text-sm">{project.description}</p>
                        </div>
                        <Button
                            variant="danger"
                            className="text-xs px-2 py-1"
                            onClick={async () => {
                                if (window.confirm('Are you sure you want to remove this project?')) {
                                    await removeProjectFromEvent(event.id, project.id);
                                    fetchEvent();
                                }
                            }}
                        >Remove</Button>
                    </div>
                ))}
            </div>
          </div>
        )}
        {activeTab === 'criteria' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Voting Criteria</h2>
              <Button onClick={() => handleOpenModal('addCriteria')}>Add Criteria</Button>
            </div>
            <div className="bg-white shadow rounded-lg">
              {event.criteria && event.criteria.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {event.criteria.map((criterion, index) => (
                    <li key={index} className="px-6 py-4 flex justify-between items-center">
                      <div>
                        <span className="font-medium">{criterion.name}</span>
                        <span className="text-sm text-gray-500 ml-2">(Max: {criterion.maxScore})</span>
                      </div>
                      <Button 
                        variant="danger" 
                        onClick={() => handleRemoveCriteria(index)}
                        className="text-sm px-3 py-1"
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-8 text-center text-gray-500">
                  <p>No criteria defined yet. Add criteria to customize your voting system.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Event Settings</h2>
            <form onSubmit={handleSaveSettings} className="bg-white shadow p-6 rounded-lg space-y-4">
              <Input label="Event Name" value={event.name} onChange={e => setEvent({...event, name: e.target.value})} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={event.description} onChange={e => setEvent({...event, description: e.target.value})} rows={4} className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Date" type="date" value={event.date} onChange={e => setEvent({...event, date: e.target.value})} />
                <Input label="Start Time" type="time" value={event.startTime} onChange={e => setEvent({...event, startTime: e.target.value})} />
                <Input label="Close Time" type="time" value={event.closeTime} onChange={e => setEvent({...event, closeTime: e.target.value})} />
              </div>
              <div className="text-right">
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={
        modalContent === 'addGroup' ? 'Add a New Group' : 
        modalContent === 'addProject' ? 'Add a New Project' : 
        modalContent === 'addCriteria' ? 'Add a New Criteria' : ''
      }>
        {renderModalContent()}
      </Modal>

    </div>
  );
};

export default EventDetailPage;