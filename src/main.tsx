import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import { ThemeProvider } from '@emotion/react'
import { createTheme } from '@mui/material'

const darkTheme = createTheme({
    palette: {
        mode: 'dark'
    }
})

createRoot(document.getElementById('root')!).render(
    <ThemeProvider theme={darkTheme}>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/:id" element={<App />} />
            </Routes>
        </BrowserRouter>
    </ThemeProvider>
)
