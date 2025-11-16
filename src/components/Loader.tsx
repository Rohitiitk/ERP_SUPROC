import React from 'react';
import '../index.css'; // make sure loader CSS is loaded

const Loader: React.FC = () => (
  <div className="loader">
    <div className="item1"></div>
    <div className="item2"></div>
    <div className="item3"></div>
  </div>
);

export default Loader;
