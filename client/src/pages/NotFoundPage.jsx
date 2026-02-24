import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

const NotFoundPage = () => (
  <div className=" bpmf-huninn-regular min-h-screen bg-bg-light flex flex-col items-center justify-center text-center px-6">
    <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
      <Zap size={28} className="text-primary" />
    </div>
    <h1 className="font-heading font-bold text-6xl text-primary mb-2">404</h1>
    <p className="text-lg text-gray-500 mb-6">Page not found.</p>
    <Link to="/" className="btn-primary px-8 py-3">Go Home</Link>
  </div>
);

export default NotFoundPage;
