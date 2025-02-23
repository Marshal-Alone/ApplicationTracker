import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Download, Chrome, FileText, Zap, CheckCircle2, AlertCircle, FolderOpen, Settings2, Play } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { downloadExtension } from '../api/simpleDownload';

export const ExtensionDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      await downloadExtension();

      toast({
        title: "Extension Download Started!",
        description: "Follow the setup instructions below to install the extension.",
      });

    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "There was an error downloading the extension. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const setupSteps = [
    {
      icon: Download,
      title: "Download the Extension",
      description: "Click the download button above to get the extension zip file from Google Drive",
      color: "blue"
    },
    {
      icon: FolderOpen,
      title: "Extract the ZIP File",
      description: "Right-click the downloaded file and select 'Extract All' or use your preferred extraction tool",
      color: "green"
    },
    {
      icon: Chrome,
      title: "Open Chrome Extensions",
      description: "Navigate to chrome://extensions/ in your Chrome browser or click the puzzle icon → Manage Extensions",
      color: "orange"
    },
    {
      icon: Settings2,
      title: "Enable Developer Mode",
      description: "Toggle the 'Developer mode' switch in the top-right corner of the extensions page",
      color: "purple"
    },
    {
      icon: FileText,
      title: "Load Unpacked Extension",
      description: "Click 'Load unpacked' button and select the extracted extension folder",
      color: "indigo"
    },
    {
      icon: Play,
      title: "Start Using!",
      description: "Visit any supported job site and the extension will automatically detect job postings",
      color: "pink"
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-600" },
      green: { bg: "bg-green-50", text: "text-green-700", icon: "text-green-600" },
      orange: { bg: "bg-orange-50", text: "text-orange-700", icon: "text-orange-600" },
      purple: { bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-600" },
      indigo: { bg: "bg-indigo-50", text: "text-indigo-700", icon: "text-indigo-600" },
      pink: { bg: "bg-pink-50", text: "text-pink-700", icon: "text-pink-600" }
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8">
      {/* Header Card */}
      <Card className="w-full shadow-lg border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <Chrome className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            JobTracker Chrome Extension
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Automatically extract and save job applications with one click
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <Zap className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">Auto Extract</p>
                <p className="text-xs text-green-700">Instant job data capture</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-900">One-Click Save</p>
                <p className="text-xs text-blue-700">Save to your tracker</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <Chrome className="h-6 w-6 text-orange-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-900">Chrome Ready</p>
                <p className="text-xs text-orange-700">Works seamlessly</p>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <div className="text-center py-4">
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              size="lg"
              className="w-full md:w-auto px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Download className="mr-2 h-5 w-5" />
              {isDownloading ? 'Opening Download...' : 'Download Extension'}
            </Button>
            <p className="text-sm text-gray-500 mt-3">
              Free • Open Source • Privacy Focused
            </p>
          </div>

          {/* Supported Sites */}
          <div className="text-center bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Works on Popular Job Sites:</p>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">LinkedIn</span>
              <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">Internshala</span>
              <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">Indeed</span>
              <span className="px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">Naukri</span>
              <span className="px-4 py-2 bg-pink-100 text-pink-800 rounded-full text-sm font-medium">Glassdoor</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card className="w-full shadow-lg border-2">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            Setup Instructions
          </CardTitle>
          <CardDescription>
            Follow these simple steps to install and start using the extension
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {setupSteps.map((step, index) => {
              const colors = getColorClasses(step.color);
              const StepIcon = step.icon;

              return (
                <div
                  key={index}
                  className="flex gap-4 p-4 rounded-lg border-2 hover:shadow-md transition-shadow duration-200"
                >
                  <div className={`flex-shrink-0 w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center`}>
                    <StepIcon className={`h-6 w-6 ${colors.icon}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold ${colors.text} text-sm`}>STEP {index + 1}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 text-lg mb-1">{step.title}</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tips & Troubleshooting */}
      <Card className="w-full shadow-lg border-2 border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Tips & Troubleshooting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              <strong>Pin the extension:</strong> Click the puzzle icon in Chrome and pin JobTracker for easy access
            </p>
          </div>
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              <strong>Refresh after install:</strong> Reload job site pages after installing the extension
            </p>
          </div>
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              <strong>Check permissions:</strong> Make sure the extension has permission to access job sites
            </p>
          </div>
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              <strong>Not working?</strong> Try disabling and re-enabling the extension, or reload Chrome
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
