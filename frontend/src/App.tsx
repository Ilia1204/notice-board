import { HashRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './components/AuthProvider';
import { Header } from './components/Header';
import { RequireRole } from './components/RequireRole';
import { CategoriesPage } from './pages/CategoriesPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
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
