import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { TrackerProvider } from "./context/TrackerContext";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Applications } from "./components/Applications";
import { Companies } from "./components/Companies";
import { Interviews } from "./components/Interviews";
import { Analytics } from "./components/Analytics";
import { ExtensionDownload } from "./components/ExtensionDownload";
import { Settings } from "./components/Settings";
import NotFound from "./components/NotFound";

const App = () => (
  <AuthProvider>
    <TrackerProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="applications" element={<Applications />} />
              <Route path="interviews" element={<Interviews />} />
              <Route path="companies" element={<Companies />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="extension" element={<ExtensionDownload />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </TrackerProvider>
  </AuthProvider>
);

export default App;
