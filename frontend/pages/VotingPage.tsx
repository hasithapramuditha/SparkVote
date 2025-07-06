import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Event, VoteCriterion, Group, Project, Vote } from '../types';
import { getEventByVoteCode, submitVote, validateGroupPassword } from '../services/api';
import Spinner from '../components/Spinner';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';

const VotingPage: React.FC = () => {
  const { voteCode } = useParams<{ voteCode: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [votes, setVotes] = useState<{ [projectId: string]: { [criteriaId: string]: number } }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
  const [error, setError] = useState('');

  const [groupForPasswordCheck, setGroupForPasswordCheck] = useState<Group | null>(null);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [validatedPassword, setValidatedPassword] = useState<string>('');

  const [votingCountdown, setVotingCountdown] = useState<string>('');
  const [votingStatus, setVotingStatus] = useState<string>('');

  useEffect(() => {
    if (voteCode) {
      getEventByVoteCode(voteCode)
        .then(data => {
          if (data) {
            setEvent(data);
          } else {
            setError('Invalid voting code.');
          }
          setLoading(false);
        })
        .catch(() => {
          setError('Could not fetch event details.');
          setLoading(false);
        });
    }
  }, [voteCode]);

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

  const handleScoreChange = (projectId: string, criteriaId: string, score: number) => {
    setVotes((prev: { [projectId: string]: { [criteriaId: string]: number } }) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [criteriaId]: score
      }
    }));
  };

  const handleGroupSelection = (group: Group) => {
    if (group.hasPassword || group.password) {
      setGroupForPasswordCheck(group);
      setEnteredPassword('');
      setPasswordError('');
      setPasswordModalOpen(true);
    } else {
      setSelectedGroup(group);
    }
  };

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!groupForPasswordCheck || !voteCode) return;
    
    try {
      const isValid = await validateGroupPassword(voteCode, groupForPasswordCheck.id, enteredPassword);
      if (isValid) {
        setSelectedGroup(groupForPasswordCheck);
        setValidatedPassword(enteredPassword); // Store the validated password
        setPasswordModalOpen(false);
        setGroupForPasswordCheck(null);
        setEnteredPassword('');
      } else {
        setPasswordError('Invalid password. Please try again.');
        setEnteredPassword('');
      }
    } catch (error) {
      console.error('Password validation error:', error);
      setPasswordError('Failed to validate password. Please try again.');
      setEnteredPassword('');
    }
  };

  const handleSubmit = async () => {
    if (!event || !selectedGroup) return;

    setIsSubmitting(true);
    const votesToSubmit = Object.entries(votes).map(([projectId, scores]) => ({
      projectId,
      groupId: selectedGroup.id,
      scores: scores as { [criteria: string]: number }
    }));

    try {
      const success = await submitVote(event.id, {
        votes: votesToSubmit,
        groupPassword: validatedPassword || selectedGroup.password
      });
      
      if (success) {
        const voteSummary = {
          eventId: event.id,
          groupName: selectedGroup.name,
          votes: votes,
          projects: event.projects,
          criteria: event.criteria
        };
        sessionStorage.setItem('lastVote', JSON.stringify(voteSummary));

        setConfirmModalOpen(false);
        navigate(`/results/${event.id}`);
      }
    } catch(err) {
      console.error("Failed to submit votes", err);
      // show error to user
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <div className="text-center text-red-500 font-bold text-xl">{error}</div>;
  if (!event) return <div>Event not found.</div>;

  if (!selectedGroup) {
    return (
      <>
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-center mb-4">Welcome to {event.name}</h1>
          <div className="mb-4 flex flex-col items-center">
            <span className={`font-semibold ${votingStatus === 'open' ? 'text-green-600' : votingStatus === 'closed' ? 'text-red-600' : 'text-yellow-600'}`}>Voting Status: {votingStatus.charAt(0).toUpperCase() + votingStatus.slice(1)}</span>
            <span className="text-gray-500">{votingCountdown}</span>
          </div>
          <p className="text-center text-gray-600 mb-8">Please select your voter group to continue.</p>
          <div className="space-y-4">
            {event.groups.map(group => (
              <Button key={group.id} onClick={() => handleGroupSelection(group)} className="w-full text-lg py-4">
                I am in the "{group.name}" group
              </Button>
            ))}
          </div>
        </div>
        <Modal 
          isOpen={isPasswordModalOpen} 
          onClose={() => setPasswordModalOpen(false)} 
          title={`Enter Password for "${groupForPasswordCheck?.name}"`}
        >
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">This voter group is password protected. Please enter the password to continue.</p>
            <Input 
              label="Group Password"
              id="group-password"
              type="password"
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              autoFocus
            />
            {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
            <div className="mt-6 flex justify-end space-x-4">
              <Button type="button" variant="secondary" onClick={() => setPasswordModalOpen(false)}>Cancel</Button>
              <Button type="submit">Enter</Button>
            </div>
          </form>
        </Modal>
      </>
    );
  }

  if (!event.projects || event.projects.length === 0) {
    return <div className="text-center text-gray-500 text-xl mt-12">No projects available for voting.</div>;
  }

  if (!event.criteria || event.criteria.length === 0) {
    return <div className="text-center text-gray-500 text-xl mt-12">No voting criteria defined for this event. Please contact the event organizer.</div>;
  }

  const allProjectsVoted = event.projects.every(p => votes[p.id] && event.criteria.every(c => votes[p.id][c.name] !== undefined));

  if (votingStatus !== 'open') {
    return (
      <div className="max-w-xl mx-auto text-center mt-12">
        <h1 className="text-3xl font-bold mb-4">Voting for {event.name}</h1>
        <span className={`font-semibold ${votingStatus === 'open' ? 'text-green-600' : votingStatus === 'closed' ? 'text-red-600' : 'text-yellow-600'}`}>Voting Status: {votingStatus.charAt(0).toUpperCase() + votingStatus.slice(1)}</span>
        <div className="text-gray-500 mt-2 mb-6">{votingCountdown}</div>
        <p className="text-lg text-gray-600">Voting is not open at this time. Please check back later.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Voting for {event.name}</h1>
      <p className="text-gray-600 mb-6">You are voting as part of the <span className="font-semibold text-blue-600">{selectedGroup.name}</span> group.</p>

      <div className="space-y-6">
        {event.projects.map((project: Project) => (
          <Card key={project.id}>
            <h2 className="text-2xl font-bold mb-2">{project.name}</h2>
            <p className="text-gray-600 mb-4">{project.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(event.criteria || []).map(criteria => (
                <div key={criteria.name}>
                  <label className="font-medium">{criteria.name}</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm text-gray-500">1</span>
                     <input
                        type="range"
                        min="1"
                        max={criteria.maxScore}
                        value={votes[project.id]?.[criteria.name] || 1}
                        onChange={(e) => handleScoreChange(project.id, criteria.name, parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    <span className="text-sm text-gray-500">{criteria.maxScore}</span>
                    <span className="font-bold w-6 text-center">{votes[project.id]?.[criteria.name]}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      
      <div className="mt-8 text-center">
        <Button onClick={() => setConfirmModalOpen(true)} disabled={!allProjectsVoted || isSubmitting} className="px-12 py-4 text-xl">
          Submit Vote
        </Button>
        {!allProjectsVoted && <p className="text-sm text-gray-500 mt-2">Please score all criteria for all projects before submitting.</p>}
      </div>

      <Modal isOpen={isConfirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirm Your Vote">
        <p className="text-gray-600">Are you sure you want to submit your votes? This action cannot be undone.</p>
        <div className="mt-6 flex justify-end space-x-4">
          <Button variant="secondary" onClick={() => setConfirmModalOpen(false)}>Review Votes</Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>Confirm and Submit</Button>
        </div>
      </Modal>
    </div>
  );
};

export default VotingPage;
