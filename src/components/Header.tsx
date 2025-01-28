import React, { useState } from 'react';
import { Search, Plus, User as UserIcon, Key, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from './AuthModal';
import { ApiKeyModal } from './ApiKeyModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-8 py-4 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search applications, companies, or positions..."
              className="pl-12 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl transition-all duration-200"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {isAuthenticated && user ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApiKeyModalOpen(true)}
                className="h-10 px-3.5 border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100/50 rounded-xl transition-all duration-200 font-medium"
              >
                <Key className="w-4 h-4 mr-2 text-blue-600" />
                Extension Key
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-800 max-w-[120px] truncate">
                      {user.name}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5">
                  <DropdownMenuLabel className="font-normal p-2">
                    <div className="text-xs font-semibold text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setApiKeyModalOpen(true)}
                    className="gap-2 cursor-pointer rounded-lg text-xs font-medium"
                  >
                    <Key className="w-4 h-4 text-blue-600" />
                    Chrome Extension API Key
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="gap-2 cursor-pointer rounded-lg text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAuthModalOpen(true)}
                className="h-10 px-4 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-medium"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
              <Button
                size="sm"
                onClick={() => setAuthModalOpen(true)}
                className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm font-medium"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />
    </header>
  );
};
