import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Activity } from "@shared/schema";
import { History, AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const getActivityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getActivityDotColor = (severity: string): string => {
    switch (severity) {
      case "error":
        return "bg-red-500";
      case "warning":
        return "bg-yellow-500";
      case "success":
        return "bg-green-500";
      default:
        return "bg-blue-500";
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Card>
      <div className="p-4 bg-gray-50 border-b rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <History className="h-5 w-5 mr-2" />
          Recent Activity Feed
        </h2>
      </div>
      <CardContent className="p-0">
        <ScrollArea className="h-64">
          {activities.length > 0 ? (
            <div className="p-4 space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getActivityDotColor(activity.severity)}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {activity.message}
                      </span>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {formatTimeAgo(activity.timestamp!)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getActivityIcon(activity.severity)}
                      <span className="text-xs text-gray-600 capitalize">
                        {activity.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <History className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No recent activities</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
