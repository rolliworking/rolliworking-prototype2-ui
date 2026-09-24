import { Link } from 'react-router-dom';

export default function RcNotFound() {
  return (
    <div className="pt-8" data-testid="rc-not-found">
      <h1 className="font-serif text-4xl font-light tracking-tight">That page isn’t here.</h1>
      <p className="mt-3 text-[15px] text-rc-muted"><Link to="/rc/home" className="text-rc-ink underline decoration-rc-accent underline-offset-4">Back to your watches</Link></p>
    </div>
  );
}
