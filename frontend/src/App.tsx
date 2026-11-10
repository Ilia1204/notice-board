import { HashRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './components/AuthProvider';
import { FavoritesProvider } from './components/FavoritesProvider';
import { Header } from './components/Header';
import { RequireRole } from './components/RequireRole';
import { SocketProvider } from './components/SocketProvider';
import { UnreadProvider } from './components/UnreadProvider';
import { AdPage } from './pages/AdPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ChatPage } from './pages/ChatPage';
import { ChatsPage } from './pages/ChatsPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { EditAdPage } from './pages/EditAdPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ModerationPage } from './pages/ModerationPage';
import { MyAdsPage } from './pages/MyAdsPage';
import { NewAdPage } from './pages/NewAdPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';

// HashRouter: адреса вида /#/login работают и на GitHub Pages без настройки сервера
function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <UnreadProvider>
          <FavoritesProvider>
            <HashRouter>
              <Header />
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                  path="/ads/new"
                  element={
                    <RequireRole>
                      <NewAdPage />
                    </RequireRole>
                  }
                />
                <Route path="/ads/:id" element={<AdPage />} />
                <Route
                  path="/ads/:id/edit"
                  element={
                    <RequireRole>
                      <EditAdPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/my-ads"
                  element={
                    <RequireRole>
                      <MyAdsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/favorites"
                  element={
                    <RequireRole>
                      <FavoritesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/chats"
                  element={
                    <RequireRole>
                      <ChatsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/chats/:id"
                  element={
                    <RequireRole>
                      <ChatPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireRole>
                      <ProfilePage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/moderation"
                  element={
                    <RequireRole role="MODERATOR">
                      <ModerationPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/complaints"
                  element={
                    <RequireRole role="MODERATOR">
                      <ComplaintsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <RequireRole role="MODERATOR">
                      <CategoriesPage />
                    </RequireRole>
                  }
                />
              </Routes>
            </HashRouter>
          </FavoritesProvider>
        </UnreadProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
