import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../modules/auth/AuthContext';
import { CheckCircle, XCircle, Loader2, Database, User, Shield, Wifi } from 'lucide-react';

type TestResult = {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: string;
};

const TestSupabasePage: React.FC = () => {
  const { user, isAuthenticated, register, login, logout } = useAuth();
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testName, setTestName] = useState('');

  const updateTest = (name: string, status: TestResult['status'], message: string, details?: string) => {
    setTests(prev => {
      const existing = prev.find(t => t.name === name);
      if (existing) {
        return prev.map(t => t.name === name ? { ...t, status, message, details } : t);
      }
      return [...prev, { name, status, message, details }];
    });
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTests([]);

    // Test 1: Configuration check
    updateTest('Configuration', 'pending', 'Vérification de la configuration...');
    if (isSupabaseConfigured) {
      updateTest('Configuration', 'success', 'Variables d'environnement configurées', 
        `URL: ${import.meta.env.VITE_SUPABASE_URL?.substring(0, 30)}...`);
    } else {
      updateTest('Configuration', 'error', 'Variables d'environnement manquantes',
        'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis');
      setIsRunning(false);
      return;
    }

    // Test 2: Connection test
    updateTest('Connexion', 'pending', 'Test de connexion à Supabase...');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      updateTest('Connexion', 'success', 'Connexion à Supabase réussie',
        data.session ? `Session active: ${data.session.user.email}` : 'Pas de session active');
    } catch (err: any) {
      updateTest('Connexion', 'error', 'Échec de la connexion', err.message);
    }

    // Test 3: Auth service health
    updateTest('Service Auth', 'pending', 'Vérification du service d'authentification...');
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error && error.message !== 'Auth session missing!') {
        throw error;
      }
      updateTest('Service Auth', 'success', 'Service d'authentification opérationnel',
        data.user ? `Utilisateur connecté: ${data.user.email}` : 'Aucun utilisateur connecté');
    } catch (err: any) {
      updateTest('Service Auth', 'error', 'Service d'authentification indisponible', err.message);
    }

    // Test 4: Database connection (try to query a table)
    updateTest('Base de données', 'pending', 'Test de la base de données...');
    try {
      // Try to query - this might fail if table doesn't exist, but connection should work
      const { error } = await supabase.from('_test_connection').select('*').limit(1);
      if (error && error.code === '42P01') {
        // Table doesn't exist - but connection works!
        updateTest('Base de données', 'success', 'Connexion à la base de données OK',
          'La connexion fonctionne (table de test non trouvée, ce qui est normal)');
      } else if (error) {
        throw error;
      } else {
        updateTest('Base de données', 'success', 'Base de données accessible');
      }
    } catch (err: any) {
      if (err.message?.includes('relation') || err.code === '42P01') {
        updateTest('Base de données', 'success', 'Connexion à la base de données OK',
          'Connexion établie (certaines tables peuvent manquer)');
      } else {
        updateTest('Base de données', 'error', 'Erreur base de données', err.message);
      }
    }

    setIsRunning(false);
  };

  const testSignUp = async () => {
    if (!testEmail || !testPassword || !testName) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    
    updateTest('Inscription', 'pending', 'Test d'inscription en cours...');
    const result = await register(testName, testEmail, testPassword);
    
    if (result.success) {
      updateTest('Inscription', 'success', 'Inscription réussie!', 
        'Vérifiez votre email pour confirmer le compte (si confirmations activées)');
    } else {
      updateTest('Inscription', 'error', 'Échec de l'inscription', result.error);
    }
  };

  const testSignIn = async () => {
    if (!testEmail || !testPassword) {
      alert('Veuillez remplir email et mot de passe');
      return;
    }
    
    updateTest('Connexion utilisateur', 'pending', 'Test de connexion...');
    const result = await login(testEmail, testPassword);
    
    if (result.success) {
      updateTest('Connexion utilisateur', 'success', 'Connexion réussie!');
    } else {
      updateTest('Connexion utilisateur', 'error', 'Échec de la connexion', result.error);
    }
  };

  const testSignOut = async () => {
    updateTest('Déconnexion', 'pending', 'Déconnexion en cours...');
    await logout();
    updateTest('Déconnexion', 'success', 'Déconnexion réussie');
  };

  useEffect(() => {
    runAllTests();
  }, []);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className=\"w-5 h-5 text-blue-500 animate-spin\" />;
      case 'success':
        return <CheckCircle className=\"w-5 h-5 text-green-500\" />;
      case 'error':
        return <XCircle className=\"w-5 h-5 text-red-500\" />;
    }
  };

  const getStatusBg = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'success':
        return 'bg-green-500/10 border-green-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
    }
  };

  return (
    <div className=\"min-h-screen bg-slate-950 text-white p-8\">
      <div className=\"max-w-3xl mx-auto\">
        <h1 className=\"text-3xl font-bold mb-2\">Test de connexion Supabase</h1>
        <p className=\"text-slate-400 mb-8\">Vérifiez que votre configuration Supabase fonctionne correctement</p>

        {/* Current Auth Status */}
        <div className=\"mb-8 p-4 bg-slate-900 border border-slate-700 rounded-xl\">
          <div className=\"flex items-center gap-3 mb-2\">
            <User className=\"w-5 h-5 text-blue-400\" />
            <span className=\"font-semibold\">État de l'authentification</span>
          </div>
          {isAuthenticated ? (
            <div className=\"text-green-400\">
              ✓ Connecté en tant que: {user?.email}
            </div>
          ) : (
            <div className=\"text-yellow-400\">
              ○ Non connecté
            </div>
          )}
        </div>

        {/* Test Results */}
        <div className=\"mb-8\">
          <div className=\"flex items-center justify-between mb-4\">
            <h2 className=\"text-xl font-semibold flex items-center gap-2\">
              <Wifi className=\"w-5 h-5\" />
              Tests automatiques
            </h2>
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className=\"px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-lg font-medium transition-colors\"
            >
              {isRunning ? 'Tests en cours...' : 'Relancer les tests'}
            </button>
          </div>

          <div className=\"space-y-3\">
            {tests.map((test) => (
              <div
                key={test.name}
                className={`p-4 rounded-xl border ${getStatusBg(test.status)}`}
              >
                <div className=\"flex items-center gap-3\">
                  {getStatusIcon(test.status)}
                  <div className=\"flex-1\">
                    <div className=\"font-medium\">{test.name}</div>
                    <div className=\"text-sm text-slate-400\">{test.message}</div>
                    {test.details && (
                      <div className=\"text-xs text-slate-500 mt-1 font-mono\">{test.details}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manual Auth Tests */}
        <div className=\"bg-slate-900 border border-slate-700 rounded-xl p-6\">
          <h2 className=\"text-xl font-semibold mb-4 flex items-center gap-2\">
            <Shield className=\"w-5 h-5\" />
            Tests manuels d'authentification
          </h2>

          <div className=\"space-y-4 mb-6\">
            <div>
              <label className=\"block text-sm text-slate-400 mb-1\">Nom</label>
              <input
                type=\"text\"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder=\"John Doe\"
                className=\"w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500\"
              />
            </div>
            <div>
              <label className=\"block text-sm text-slate-400 mb-1\">Email</label>
              <input
                type=\"email\"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder=\"test@example.com\"
                className=\"w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500\"
              />
            </div>
            <div>
              <label className=\"block text-sm text-slate-400 mb-1\">Mot de passe</label>
              <input
                type=\"password\"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder=\"••••••••\"
                className=\"w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500\"
              />
            </div>
          </div>

          <div className=\"flex flex-wrap gap-3\">
            <button
              onClick={testSignUp}
              className=\"px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors\"
            >
              Tester l'inscription
            </button>
            <button
              onClick={testSignIn}
              className=\"px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors\"
            >
              Tester la connexion
            </button>
            <button
              onClick={testSignOut}
              className=\"px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium transition-colors\"
            >
              Tester la déconnexion
            </button>
          </div>
        </div>

        {/* Info */}
        <div className=\"mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-xl\">
          <h3 className=\"font-semibold mb-2 flex items-center gap-2\">
            <Database className=\"w-4 h-4\" />
            Configuration requise dans Supabase
          </h3>
          <ul className=\"text-sm text-slate-400 space-y-1 list-disc list-inside\">
            <li>Activer l'authentification par email dans Authentication → Providers</li>
            <li>Configurer les URL de redirection dans Authentication → URL Configuration</li>
            <li>Créer les tables nécessaires (friends, tasks, etc.) si besoin</li>
            <li>Vérifier les politiques RLS (Row Level Security) si activées</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestSupabasePage;
