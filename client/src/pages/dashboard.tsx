import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DisasterMap } from "@/components/disaster-map";
import { StatsPanel } from "@/components/stats-panel";
import { ResponseViewer } from "@/components/response-viewer";
import { ActivityFeed } from "@/components/activity-feed";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { type Disaster, type SystemStats, type Activity } from "@shared/schema";
import { Satellite, RefreshCw, Crosshair } from "lucide-react";

export default function Dashboard() {
  const [selectedDisaster, setSelectedDisaster] = useState<Disaster | null>(null);
  const queryClient = useQueryClient();
  const { isConnected, lastMessage } = useWebSocket();

  // Queries
  const { data: disasters = [], isLoading: disastersLoading } = useQuery<Disaster[]>({
    queryKey: ["/api/disasters"],
    refetchInterval: 15000, // Refresh every 15 seconds to see processed disasters faster
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  const { data: stats, isLoading: statsLoading } = useQuery<SystemStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    refetchInterval: 30000,
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'stats':
        queryClient.setQueryData(["/api/stats"], lastMessage.data);
        break;
      case 'disasters':
        queryClient.setQueryData(["/api/disasters"], lastMessage.data);
        // Force a refresh to ensure we get the latest processed disasters
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

  const handleCenterMap = () => {
    // This would be handled by the map component
    setSelectedDisaster(null);
  };

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
                // Could open a detailed modal or navigate to details page
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
                  disasters={disasters}
                  onSelectDisaster={setSelectedDisaster}
                  selectedDisaster={selectedDisaster}
                />
              </div>
              
              {/* Map Controls Footer */}
              <div className="p-4 bg-gray-50 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
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
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div><span className="font-semibold">{disasters.length}</span> total events</div>
                    <div><span className="font-semibold text-green-600">{disasters.filter(d => d.processed).length}</span> analyzed</div>
                    <div><span className="font-semibold text-red-600">{disasters.filter(d => d.processed && d.severity && d.severity >= 7).length}</span> high severity</div>
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
