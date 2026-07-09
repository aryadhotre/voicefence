import { Routes, Route } from "react-router-dom"
import { Layout } from "@/components/layout/Layout"
import Landing from "@/pages/Landing"
import Analyze from "@/pages/Analyze"
import LiveListen from "@/pages/LiveListen"
import HowItWorks from "@/pages/HowItWorks"
import Login from "@/pages/Login"
import Signup from "@/pages/Signup"

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="analyze" element={<Analyze />} />
        <Route path="live" element={<LiveListen />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
      </Route>
    </Routes>
  )
}

export default App
