import { h, render } from 'preact';

const App = () => (
  <div id="app">
    <span>Foobar!</span>
    <a href="auth/google">Login</a>
  </div>
);

render(<App />, document.getElementById('root'));
