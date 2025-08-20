import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import { GA4Provider } from './GA4.tsx'
import { HelmetProvider } from 'react-helmet-async'
import { ThemeProvider, createTheme } from '@mui/material'

import './i18n'
import { ConfirmProvider } from './useConfirm.tsx'

const tag = 'G-8LB2TBRTP5'

const theme = createTheme({
    typography: {
        fontSize: 16,
        body1: {
            fontSize: '1rem'
        },
        h1: {
            fontSize: '1.8em',
            fontWeight: 700,
            lineHeight: 1.5
        },
        h2: {
            fontSize: '1.6em',
            fontWeight: 700,
            lineHeight: 1.5
        },
        h3: {
            fontSize: '1.4em',
            fontWeight: 700,
            lineHeight: 1.5
        },
        h4: {
            fontSize: '1.2em',
            fontWeight: 700
        },
        h5: {
            fontSize: '1em',
            fontWeight: 700
        },
        h6: {
            fontSize: '0.9em',
            fontWeight: 700
        }
    },
    breakpoints: {
        values: {
            xs: 0,
            sm: 550,
            md: 960,
            lg: 1280,
            xl: 1920
        }
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                '::-webkit-scrollbar': {
                    width: '10px',
                    height: '10px'
                },
                '::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '10px'
                }
            }
        }
    }
})

createRoot(document.getElementById('root')!).render(
    <ThemeProvider theme={theme}>
        <ConfirmProvider>
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
        </ConfirmProvider>
    </ThemeProvider>
)
