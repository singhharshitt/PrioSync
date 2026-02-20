import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

const NotFoundPage = () => (
    <div className="min-h-screen hero-gradient flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#604C39]/20 flex items-center justify-center mb-5">
            <Zap size={28} className="text-[#c4a882]" />
        </div>
        <h1 className="font-heading font-bold text-6xl text-white mb-2">404</h1>
        <p className="text-lg text-[#94a3b8] mb-6">Page not found.</p>
        <Link to="/" className="btn-primary px-8 py-3">Go Home</Link>
    </div>
);

export default NotFoundPage;
