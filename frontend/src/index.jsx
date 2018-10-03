import { h, render } from 'preact';

const App = () => (
  <div id="app">
    <p>Welcome to the App!</p>
    <a href="/logout">Logout</a>
  </div>
);

window.onload = () => render(<App />, document.getElementById('body'));
