import { Routes, Route } from "react-router-dom"
import { Layout } from "@/components/layout/Layout"
import Landing from "@/pages/Landing"
import Analyze from "@/pages/Analyze"
import LiveListen from "@/pages/LiveListen"
import HowItWorks from "@/pages/HowItWorks"

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="analyze" element={<Analyze />} />
        <Route path="live" element={<LiveListen />} />
        <Route path="how-it-works" element={<HowItWorks />} />
      </Route>
    </Routes>
  )
}

export default App
