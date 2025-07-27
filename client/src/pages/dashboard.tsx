import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { DisasterMap } from "@/components/disaster-map";
import { StatsPanel } from "@/components/stats-panel";
import { ResponseViewer } from "@/components/response-viewer";
import { ActivityFeed } from "@/components/activity-feed";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { type Disaster, type SystemStats, type Activity } from "@shared/schema";
import { Satellite, RefreshCw, Crosshair, Zap } from "lucide-react";

type FilterType = 'all' | 'processed' | 'unprocessed';
type SeverityFilter = 'all' | 'high' | 'medium' | 'low';

export default function Dashboard() {
  const [selectedDisaster, setSelectedDisaster] = useState<Disaster | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('processed'); // Default to processed only
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [triggerCenter, setTriggerCenter] = useState(false);
  const queryClient = useQueryClient();
  const { isConnected, lastMessage } = useWebSocket();
  const { toast } = useToast();

  const { data: disasters = [], isLoading: disastersLoading } = useQuery<Disaster[]>({
    queryKey: ["/api/disasters"],
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<SystemStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'stats':
        queryClient.setQueryData(["/api/stats"], lastMessage.data);
        break;
      case 'disasters':
        queryClient.setQueryData(["/api/disasters"], lastMessage.data);
        queryClient.invalidateQueries({ queryKey: ["/api/disasters"] });
        break;
      case 'activities':
        queryClient.setQueryData(["/api/activities"], lastMessage.data);
        break;
    }
  }, [lastMessage, queryClient]);

  const handleRefreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/disasters"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] }),
    ]);
  };

  const { mutate: processAll, isPending: isProcessingAll } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/process-all', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to process disasters');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Processing Complete",
        description: `Successfully analyzed ${data.count} disasters`,
      });
      handleRefreshData();
    },
    onError: (error) => {
      toast({
        title: "Processing Failed", 
        description: error instanceof Error ? error.message : "Failed to process disasters",
        variant: "destructive",
      });
    },
  });

  const handleCenterMap = () => {
    setTriggerCenter(true);
    setSelectedDisaster(null);
    setTimeout(() => setTriggerCenter(false), 100);
  };

  const filteredDisasters = disasters.filter(disaster => {
    if (filterType === 'processed' && !disaster.processed) return false;
    if (filterType === 'unprocessed' && disaster.processed) return false;

    if (severityFilter !== 'all' && disaster.processed) {
      if (severityFilter === 'high' && (!disaster.severity || disaster.severity < 7)) return false;
      if (severityFilter === 'medium' && (!disaster.severity || disaster.severity < 4 || disaster.severity >= 7)) return false;
      if (severityFilter === 'low' && (!disaster.severity || disaster.severity >= 4)) return false;
    }

    return true;
  });

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (disastersLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h3 className="font-semibold text-gray-900 mb-2">Processing Disaster Data</h3>
          <p className="text-sm text-gray-600">Analyzing events with AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Satellite className="h-8 w-8 text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold">AI Crisis Navigator</h1>
                <p className="text-sm opacity-90">Real-Time Disaster Response System</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-sm">
                  {isConnected ? 'System Active' : 'Connection Lost'}
                </span>
              </div>
              <div className="text-sm">
                {stats && stats.lastUpdated && (
                  <span>Last Update: {formatTimeAgo(stats.lastUpdated)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          
          {/* Stats Panel */}
          <div className="lg:col-span-1">
            <StatsPanel 
              stats={stats!}
              selectedDisaster={selectedDisaster}
              onViewDetails={() => {
                console.log("View details for disaster:", selectedDisaster?.id);
              }}
              isConnected={isConnected}
            />
          </div>
          
          {/* Main Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center">
                  <Satellite className="h-5 w-5 mr-2" />
                  Global Disaster Map
                </h2>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <span className="text-xs">Low (1-3)</span>
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <span className="text-xs">Med (4-6)</span>
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <span className="text-xs">High (7-10)</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="h-96 lg:h-[600px]">
                <DisasterMap 
                  disasters={filteredDisasters}
                  onSelectDisaster={setSelectedDisaster}
                  selectedDisaster={selectedDisaster}
                  centerMap={triggerCenter}
                />
              </div>
              
              {/* Map Controls Footer */}
              <div className="p-4 bg-gray-50 border-t space-y-3">
                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Show:</span>
                    <div className="flex border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setFilterType('all')}
                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                          filterType === 'all' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        All Events
                      </button>
                      <button
                        onClick={() => setFilterType('processed')}
                        className={`px-3 py-1 text-xs font-medium transition-colors border-l ${
                          filterType === 'processed' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Analyzed Only
                      </button>
                      <button
                        onClick={() => setFilterType('unprocessed')}
                        className={`px-3 py-1 text-xs font-medium transition-colors border-l ${
                          filterType === 'unprocessed' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Pending Only
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Severity:</span>
                    <div className="flex border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setSeverityFilter('all')}
                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                          severityFilter === 'all' 
                            ? 'bg-gray-600 text-white' 
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setSeverityFilter('high')}
                        className={`px-3 py-1 text-xs font-medium transition-colors border-l ${
                          severityFilter === 'high' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        High (7-10)
                      </button>
                      <button
                        onClick={() => setSeverityFilter('medium')}
                        className={`px-3 py-1 text-xs font-medium transition-colors border-l ${
                          severityFilter === 'medium' 
                            ? 'bg-yellow-600 text-white' 
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Med (4-6)
                      </button>
                      <button
                        onClick={() => setSeverityFilter('low')}
                        className={`px-3 py-1 text-xs font-medium transition-colors border-l ${
                          severityFilter === 'low' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Low (1-3)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons and Stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRefreshData}
                      className="flex items-center space-x-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Refresh</span>
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleCenterMap}
                      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <Crosshair className="h-4 w-4" />
                      <span>Center View</span>
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => processAll()}
                      disabled={isProcessingAll}
                      className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      <Zap className="h-4 w-4" />
                      <span>{isProcessingAll ? 'Processing...' : 'Analyze All'}</span>
                    </Button>
                    <button
                      onClick={() => {
                        setFilterType('all');
                        setSeverityFilter('all');
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear Filters
                    </button>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div><span className="font-semibold">{filteredDisasters.length}</span> of {disasters.length} displayed</div>
                    <div><span className="font-semibold text-green-600">{disasters.filter(d => d.processed).length}</span> analyzed • <span className="font-semibold text-red-600">{disasters.filter(d => d.processed && d.severity && d.severity >= 7).length}</span> high severity</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Response Viewer */}
          <div className="lg:col-span-1">
            <ResponseViewer selectedDisaster={selectedDisaster} />
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="mt-8">
          <ActivityFeed activities={activities} />
        </div>
      </main>
    </div>
  );
}
