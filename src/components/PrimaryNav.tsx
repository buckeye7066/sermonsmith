import { Link } from 'react-router-dom';
const navItems = [
  // ...
];
return (
  <div>
    <h1>Primary Navigation</h1>
    <ul>
      {navItems.map((navItem, index) => (
        <li key={index}>{`<Link to="${navItem.route}"> ${navItem.label} </Link>`}</li>
      ))}
    </ul>
  </div>
);
