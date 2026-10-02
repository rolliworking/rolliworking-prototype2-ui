import RcLoginPage from '@/pages/rc/RcLoginPage';

// "Create your account" is the same passwordless door (MH ruling 2026-10-01): the first verified code creates the account and attaches it to the client on file.
export default function RcSignupPage() {
  return <RcLoginPage mode="create" />;
}
