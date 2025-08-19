import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import { GA4Provider } from './GA4.tsx'
import { HelmetProvider } from 'react-helmet-async'

const tag = 'G-8LB2TBRTP5'

createRoot(document.getElementById('root')!).render(
    <HelmetProvider>
        <BrowserRouter>
            <Routes>
                <Route
                    path="/"
                    element={
                        <GA4Provider tag={tag}>
                            <App />
                        </GA4Provider>
                    }
                />
                <Route
                    path="/:id"
                    element={
                        <GA4Provider tag={tag}>
                            <App />
                        </GA4Provider>
                    }
                />
            </Routes>
        </BrowserRouter>
    </HelmetProvider>
)
