import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Event, Vote, Project, VoteCriterion, Group } from '../types';
import { getEventById, getEventResults, getPublicEventResults, updateGroupWeight } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';
import TrophyIcon from '../components/icons/TrophyIcon';
import Card from '../components/Card';
import Input from '../components/Input';

interface Result {
  name: string;
  score: number;
}

type ViewMode = 'loading' | 'admin' | 'voter' | 'restricted';

interface VoterVoteSummary {
  groupName: string;
  votes: { [projectId: string]: { [criteriaId: string]: number } };
  projects: Project[];
  criteria: VoteCriterion[];
}

// Helper to normalize group objects
const normalizeGroup = (group: any) => ({
  ...group,
  id: group.id || group._id,
});

const ResultsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [voterVote, setVoterVote] = useState<VoterVoteSummary | null>(null);
  const [groupWeights, setGroupWeights] = useState<{ [groupId: string]: number }>({});
  const [groupList, setGroupList] = useState<any[]>([]);
  const [votingCountdown, setVotingCountdown] = useState<string>('');
  const [votingStatus, setVotingStatus] = useState<string>('');
  const [savingWeights, setSavingWeights] = useState<{ [groupId: string]: boolean }>({});

  // Debounced save function
  const saveWeightTimeoutRef = useRef<{ [groupId: string]: NodeJS.Timeout }>({});

  const handleWeightChange = (groupId: string, newWeight: number) => {
    setGroupWeights((prev: { [groupId: string]: number }) => ({
      ...prev,
      [groupId]: newWeight
    }));

    // Set saving state
    setSavingWeights(prev => ({ ...prev, [groupId]: true }));

    // Clear existing timeout for this group
    if (saveWeightTimeoutRef.current[groupId]) {
      clearTimeout(saveWeightTimeoutRef.current[groupId]);
    }

    // Debounce the save operation
    saveWeightTimeoutRef.current[groupId] = setTimeout(async () => {
      if (eventId) {
        const success = await updateGroupWeight(eventId, groupId, newWeight);
        if (success) {
          console.log(`Weight updated successfully for group ${groupId}: ${newWeight}%`);
        } else {
          console.error(`Failed to update weight for group ${groupId}`);
        }
      }
      setSavingWeights(prev => ({ ...prev, [groupId]: false }));
    }, 1000); // Save after 1 second of no changes
  };

  useEffect(() => {
    if (eventId) {
      const fetchData = async () => {
        try {
          // Determine view mode first
          const lastVoteRaw = sessionStorage.getItem('lastVote');
          let isVoter = false;
          
          if (lastVoteRaw) {
            try {
              const lastVote = JSON.parse(lastVoteRaw);
              if (lastVote.eventId === eventId) {
                setVoterVote(lastVote);
                isVoter = true;
                sessionStorage.removeItem('lastVote'); // Show only once
              }
            } catch (e) {
              console.error("Could not parse last vote from sessionStorage", e);
            }
          }

          // Try to get event data as admin first
          let eventData = null;
          let results = null;
          
          if (user) {
            try {
              eventData = await getEventById(eventId);
              if (eventData && user.id === eventData.ownerId) {
                // User is admin, get full results
                results = await getEventResults(eventId);
                setViewMode('admin');
              } else if (eventData) {
                // User is authenticated but not owner
                setViewMode('restricted');
                return;
              }
            } catch (error) {
              console.error('Failed to fetch event as admin:', error);
            }
          }

          // If not admin, try public results
          if (!eventData && !results) {
            try {
              const publicResults = await getPublicEventResults(eventId);
              if (publicResults && publicResults.event) {
                // Transform the event data to match our frontend format
                eventData = {
                  id: publicResults.event.id,
                  name: publicResults.event.name,
                  description: publicResults.event.description,
                  date: publicResults.event.date,
                  startTime: publicResults.event.startTime,
                  closeTime: publicResults.event.closeTime,
                  ownerId: '', // Not available in public results
                  voteCode: '',
                  groups: [],
                  projects: publicResults.results?.projects || [],
                  criteria: publicResults.event.criteria || []
                };
                results = publicResults;
                
                if (isVoter) {
                  setViewMode('voter');
                } else {
                  setViewMode('restricted');
                }
              } else {
                setViewMode('restricted');
                return;
              }
            } catch (error) {
              console.error('Failed to fetch public results:', error);
              setViewMode('restricted');
              return;
            }
          }

          setEvent(eventData);
          setResultsData(results);

          // Set up group weights for admin view
          if (eventData && viewMode === 'admin' && eventData.groups) {
            const initialWeights: { [groupId: string]: number } = {};
            eventData.groups.forEach(group => {
              const normGroup = normalizeGroup(group);
              initialWeights[normGroup.id] = normGroup.weight;
            });
            setGroupWeights(initialWeights);
          }

          // After setting eventData and results, also set groupList
          if (results && results.results && results.results.groups) {
            // Normalize all groups to have id field
            const normalizedGroups = results.results.groups.map(normalizeGroup);
            setGroupList(normalizedGroups);
          }

        } catch (error) {
          console.error('Failed to fetch event data:', error);
          setViewMode('restricted');
        }
      };

      fetchData();
    }
  }, [eventId, user]);
  
  // Add polling for real-time updates
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (eventId && groupList.length > 0 && viewMode === 'admin') {
      interval = setInterval(() => {
        getPublicEventResults(eventId, groupWeights)
          .then(data => {
            if (data) setResultsData(data);
          })
          .catch(() => {});
      }, 1000); // Poll every 1 second
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  // eslint-disable-next-line
  }, [eventId, groupList.length, viewMode, groupWeights]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveWeightTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

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

  // Chart data should use the latest resultsData
  const chartData = useMemo(() => {
    if (!resultsData || !resultsData.results || !resultsData.results.projects) return [];
    return resultsData.results.projects.map((project: any) => ({
      name: project.name,
      score: project.finalScore || 0
    })).sort((a: any, b: any) => b.score - a.score);
  }, [resultsData]);
  
  const results: Result[] = useMemo(() => {
    if (!resultsData || !resultsData.results || !resultsData.results.projects) return [];

    return resultsData.results.projects.map((project: any) => ({
      name: project.name,
      score: project.averageScore || 0
    })).sort((a: Result, b: Result) => b.score - a.score);
  }, [resultsData]);

  if (viewMode === 'loading') return <Spinner />;
  if (!event) return <div>Event not found.</div>;

  const getMedalColor = (index: number) => {
    if (index === 0) return 'text-yellow-500';
    if (index === 1) return 'text-gray-400';
    if (index === 2) return 'text-yellow-700';
    return 'text-gray-500';
  };
  
  if (viewMode === 'restricted') {
    return (
        <div className="text-center bg-white p-12 rounded-lg shadow max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold">Results are Private</h2>
            <p className="text-gray-500 mt-2">
                Detailed results for this event can only be viewed by the event organizer.
                <br />
                You can view a summary of your vote on this page immediately after submitting it.
            </p>
        </div>
    );
  }

  if (viewMode === 'voter' && voterVote) {
      return (
          <div className="space-y-8">
              <div className="text-center">
                  <h1 className="text-4xl font-bold">Thank You for Voting!</h1>
                  <p className="text-lg text-gray-600 mt-2">Here is a summary of your vote from the <span className="font-bold text-blue-600">{voterVote.groupName}</span> group.</p>
              </div>
              <div className="max-w-4xl mx-auto space-y-4">
                  {voterVote.projects.map(project => (
                      <Card key={project.id}>
                          <h2 className="text-2xl font-bold mb-3">{project.name}</h2>
                          <ul className="space-y-2">
                              {voterVote.criteria.map(criterion => {
                                  const score = voterVote.votes[project.id]?.[criterion.name];
                                  return (
                                      <li key={criterion.name} className="flex justify-between items-center text-lg p-2 rounded-md transition-colors hover:bg-gray-50">
                                          <span>{criterion.name}</span>
                                          <span className="font-bold text-blue-600">{score !== undefined ? score : 'N/A'} / {criterion.maxScore}</span>
                                      </li>
                                  );
                              })}
                          </ul>
                      </Card>
                  ))}
              </div>
          </div>
      );
  }

  if (viewMode === 'admin') {
     return (
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold">Results for {event.name}</h1>
            <div className="mb-2 flex flex-col items-center">
              <span className={`font-semibold ${votingStatus === 'open' ? 'text-green-600' : votingStatus === 'closed' ? 'text-red-600' : 'text-yellow-600'}`}>Voting Status: {votingStatus.charAt(0).toUpperCase() + votingStatus.slice(1)}</span>
              <span className="text-gray-500">{votingCountdown}</span>
            </div>
            {resultsData && (
              <p className="text-lg text-gray-600 mt-2">
                Total Voters: {resultsData.totalVoters || 0}
              </p>
            )}
          </div>
          
          {resultsData && resultsData.results && resultsData.results.projects.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              <div className="lg:col-span-2 space-y-8">
                <Card>
                  <h2 className="text-2xl font-semibold mb-4">Leaderboard</h2>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">Rank</th>
                        <th className="p-2">Project</th>
                        {groupList.map(group => (
                          <th key={group.id} className="p-2 text-right">{group.name} Avg</th>
                        ))}
                        <th className="p-2 text-right">Final Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultsData.results.projects.map((project: any, index: number) => (
                        <tr key={project.id} className={`border-b ${index < 3 ? 'font-bold' : ''}`}>
                          <td className={`p-4 text-center ${getMedalColor(index)}`}>
                            <div className="flex items-center justify-center">
                              {index < 3 ? <TrophyIcon className="h-6 w-6 mr-2" /> : null}
                              {project.rank}
                            </div>
                          </td>
                          <td className="p-4">{project.name}</td>
                          {groupList.map(group => (
                            <td key={group.id} className="p-4 text-right font-mono">
                              {project.groupAverages && project.groupAverages[group.name] !== undefined
                                ? project.groupAverages[group.name].toFixed(2)
                                : '-'}
                            </td>
                          ))}
                          <td className="p-4 text-right font-mono">{project.finalScore.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                <Card>
                  <h2 className="text-2xl font-semibold mb-4">Score Distribution</h2>
                   <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="score" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <Card className="lg:col-span-1">
                <h2 className="text-2xl font-semibold mb-4">Group Weights & Votes</h2>
                <div className="space-y-6">
                  {resultsData && resultsData.results && resultsData.results.groups ? (
                    resultsData.results.groups.map((group: any) => (
                      <div key={group.id}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">{group.name}</span>
                          <span className="text-sm text-gray-600 font-medium">
                            Voters: {group.voterCount || 0}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <input
                              type="range"
                              min="0"
                              max="100"
                              value={groupWeights[group.id] || group.weight || 0}
                              onChange={(e) => handleWeightChange(group.id, parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                          <div className="flex items-center space-x-2">
                            <span className="font-bold w-16 text-center text-blue-600 bg-blue-50 rounded-md py-1">
                              {groupWeights[group.id] || group.weight || 0}%
                            </span>
                            {savingWeights[group.id] && (
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No group data available</p>
                  )}
                </div>
              </Card>

            </div>
          ) : (
            <div className="text-center bg-white p-12 rounded-lg shadow">
              <h2 className="text-2xl font-semibold">No results yet.</h2>
              <p className="text-gray-500 mt-2">Votes are still being cast or no votes have been submitted.</p>
            </div>
          )}
        </div>
      );
  }

  return null; // Should not be reached in normal flow
};

export default ResultsPage;