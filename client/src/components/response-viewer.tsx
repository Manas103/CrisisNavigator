import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Disaster } from "@shared/schema";
import { Bot, AlertTriangle, CheckSquare, Route, Package, Camera, Brain } from "lucide-react";

interface ResponseViewerProps {
  selectedDisaster?: Disaster | null;
}

export function ResponseViewer({ selectedDisaster }: ResponseViewerProps) {
  if (!selectedDisaster) {
    return (
      <Card className="h-full flex flex-col">
        <div className="p-4 bg-blue-600 text-white rounded-t-lg">
          <h2 className="text-lg font-semibold flex items-center">
            <Bot className="h-5 w-5 mr-2" />
            AI Analysis
          </h2>
        </div>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 py-12">
            <Brain className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">AI Analysis Ready</p>
            <p className="text-sm">
              Select a disaster event on the map to view detailed AI-powered analysis and response recommendations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

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

  let structuredAnalysis: any = null;
  try {
    if (selectedDisaster.analysis && selectedDisaster.analysis.startsWith('{')) {
      structuredAnalysis = JSON.parse(selectedDisaster.analysis);
    }
  } catch (e) {
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 bg-blue-600 text-white rounded-t-lg">
        <h2 className="text-lg font-semibold flex items-center">
          <Bot className="h-5 w-5 mr-2" />
          AI Analysis
        </h2>
      </div>
      
      <ScrollArea className="flex-1 p-4" style={{ maxHeight: "600px" }}>
        <div className="space-y-4">
          {/* Event Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">
                {selectedDisaster.title || `${selectedDisaster.type} Event`}
              </h3>
              <Badge variant={getSeverityBadgeVariant(selectedDisaster.severity)}>
                Severity: {selectedDisaster.severity || 'Unknown'}/10
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-3">{selectedDisaster.type}</p>
          </div>

          {selectedDisaster.processed && selectedDisaster.analysis ? (
            <>
              {structuredAnalysis ? (
                <div className="space-y-4">
                  {/* Risk Assessment */}
                  {structuredAnalysis.risks && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                      <h4 className="font-semibold text-red-700 mb-2 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Top Risks Identified
                      </h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {structuredAnalysis.risks.map((risk: string, index: number) => (
                          <li key={index}>• {risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Immediate Actions */}
                  {structuredAnalysis.immediateActions && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                      <h4 className="font-semibold text-blue-700 mb-2 flex items-center">
                        <CheckSquare className="h-4 w-4 mr-1" />
                        Immediate Actions
                      </h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {structuredAnalysis.immediateActions.map((action: string, index: number) => (
                          <li key={index}>{index + 1}. {action}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Evacuation Guidance */}
                  {structuredAnalysis.evacuationGuidance && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                      <h4 className="font-semibold text-yellow-700 mb-2 flex items-center">
                        <Route className="h-4 w-4 mr-1" />
                        Evacuation Guidance
                      </h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {structuredAnalysis.evacuationGuidance.map((guidance: string, index: number) => (
                          <li key={index}>• {guidance}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Resource Priorities */}
                  {structuredAnalysis.resourcePriorities && (
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                      <h4 className="font-semibold text-green-700 mb-2 flex items-center">
                        <Package className="h-4 w-4 mr-1" />
                        Resource Priorities
                      </h4>
                      <div className="text-sm text-gray-700 space-y-2">
                        {structuredAnalysis.resourcePriorities.water && (
                          <div className="flex justify-between">
                            <span>Water (gallons)</span>
                            <span className="font-semibold">{structuredAnalysis.resourcePriorities.water.toLocaleString()}</span>
                          </div>
                        )}
                        {structuredAnalysis.resourcePriorities.medical && (
                          <div className="flex justify-between">
                            <span>Medical kits</span>
                            <span className="font-semibold">{structuredAnalysis.resourcePriorities.medical}</span>
                          </div>
                        )}
                        {structuredAnalysis.resourcePriorities.shelters && (
                          <div className="flex justify-between">
                            <span>Emergency shelters</span>
                            <span className="font-semibold">{structuredAnalysis.resourcePriorities.shelters}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Full Analysis */}
                  {structuredAnalysis.fullAnalysis && (
                    <div className="bg-gray-50 p-4 rounded">
                      <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                        <Camera className="h-4 w-4 mr-1" />
                        Detailed Analysis
                      </h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {structuredAnalysis.fullAnalysis}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded">
                  <h4 className="font-semibold text-gray-700 mb-2">Analysis Results</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedDisaster.analysis}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm">AI analysis in progress...</p>
              <p className="text-xs text-gray-400 mt-1">This may take a few moments</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Analysis Footer */}
      <div className="p-4 bg-gray-50 border-t rounded-b-lg">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            {selectedDisaster.processed ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600">Analysis Complete</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-yellow-600">Processing...</span>
              </>
            )}
          </div>
          <div className="text-gray-600 text-xs">
            Generated by Gemini AI
          </div>
        </div>
      </div>
    </Card>
  );
}
