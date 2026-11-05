// FILE: Starts the app: it puts the App component on the web page.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './funsized.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
