import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './lib/store'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const token = useAuthStore(s => s.token)
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/c/:convId" element={token ? <Dashboard /> : <Navigate to="/login" />} />
    </Routes>
  )
}
