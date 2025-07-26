import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type SystemStats, type Disaster } from "@shared/schema";
import { Satellite, BarChart3, Cog, Info, MousePointer } from "lucide-react";

interface StatsPanelProps {
  stats: SystemStats;
  selectedDisaster?: Disaster | null;
  onViewDetails?: () => void;
  isConnected: boolean;
}

export function StatsPanel({ stats, selectedDisaster, onViewDetails, isConnected }: StatsPanelProps) {
  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getSeverityColor = (severity: number | null): string => {
    if (!severity) return "text-gray-500";
    if (severity >= 7) return "text-red-600";
    if (severity >= 4) return "text-yellow-600";
    return "text-green-600";
  };

  const getSeverityBadgeVariant = (severity: number | null): "default" | "secondary" | "destructive" | "outline" => {
    if (!severity) return "outline";
    if (severity >= 7) return "destructive";
    if (severity >= 4) return "secondary";
    return "default";
  };

  return (
    <div className="space-y-6">
      {/* Global Statistics */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
            Global Statistics
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Total Events</span>
              <span className="text-xl font-bold text-blue-600">{stats.totalEvents}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Processed</span>
              <span className="text-xl font-bold text-green-600">{stats.processedEvents}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
              <span className="text-sm text-gray-700">High Severity</span>
              <span className="text-xl font-bold text-red-600">{stats.highSeverityEvents}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <span className="text-sm text-gray-700">Pending Analysis</span>
              <span className="text-xl font-bold text-yellow-600">{(stats.totalEvents ?? 0) - (stats.processedEvents ?? 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Cog className="h-5 w-5 text-blue-600 mr-2" />
            Processing Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">NASA EONET</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Gemini AI</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Processing</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">WebSocket</span>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            Last Update: {stats.lastUpdated ? formatTimeAgo(stats.lastUpdated) : 'Unknown'}
          </div>
        </CardContent>
      </Card>

      {/* Selected Event Details */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Info className="h-5 w-5 text-blue-600 mr-2" />
            Selected Event
          </h3>
          
          {selectedDisaster ? (
            <div className="space-y-3">
              <div className={`p-4 rounded border-l-4 ${
                selectedDisaster.severity && selectedDisaster.severity >= 7 
                  ? 'bg-red-50 border-red-500' 
                  : selectedDisaster.severity && selectedDisaster.severity >= 4 
                  ? 'bg-yellow-50 border-yellow-500' 
                  : 'bg-green-50 border-green-500'
              }`}>
                <h4 className="font-semibold text-gray-900">
                  {selectedDisaster.title || selectedDisaster.type}
                </h4>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">Severity:</span>
                  <Badge variant={getSeverityBadgeVariant(selectedDisaster.severity)}>
                    {selectedDisaster.severity || 'Unknown'}/10
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Lat: {selectedDisaster.latitude.toFixed(4)}, Lng: {selectedDisaster.longitude.toFixed(4)}
                </p>
                <p className="text-xs text-gray-600">
                  Updated: {formatTimeAgo(selectedDisaster.updatedAt || selectedDisaster.createdAt!)}
                </p>
              </div>
              {onViewDetails && (
                <Button 
                  onClick={onViewDetails}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  View Full Analysis
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <MousePointer className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Click on a map marker to view event details</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
