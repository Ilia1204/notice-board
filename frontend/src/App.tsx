import { HashRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './components/AuthProvider';
import { Header } from './components/Header';
import { RequireRole } from './components/RequireRole';
import { AdPage } from './pages/AdPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { EditAdPage } from './pages/EditAdPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ModerationPage } from './pages/ModerationPage';
import { MyAdsPage } from './pages/MyAdsPage';
import { NewAdPage } from './pages/NewAdPage';
import { RegisterPage } from './pages/RegisterPage';

// HashRouter: адреса вида /#/login работают и на GitHub Pages без настройки сервера
function App() {
  return (
    <AuthProvider>
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
            path="/moderation"
            element={
              <RequireRole role="MODERATOR">
                <ModerationPage />
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
    </AuthProvider>
  );
}

export default App;
