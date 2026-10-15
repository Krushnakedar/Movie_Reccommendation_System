import MockDisclaimer from '../components/MockDisclaimer';
import RecommendationWizard from '../components/RecommendationWizard';

export default function Recommendations({ onDetails }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <MockDisclaimer />
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Recommendations</h1>
        <p className="text-cinema-muted">Tell us what you like and we&apos;ll find your perfect match.</p>
      </div>
      <div className="bg-cinema-card border border-cinema-border rounded-2xl p-6 sm:p-8">
        <RecommendationWizard onDetails={onDetails} />
      </div>
    </div>
  );
}
