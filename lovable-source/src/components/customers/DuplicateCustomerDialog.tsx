import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Customer } from '@/types/database';

interface DuplicateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateCustomer: Customer | null;
  softMatches: Customer[];
  onUseExisting: (customer: Customer) => void;
  onCreateAnyway: () => void;
  isAdmin: boolean;
}

export function DuplicateCustomerDialog({
  open,
  onOpenChange,
  duplicateCustomer,
  softMatches,
  onUseExisting,
  onCreateAnyway,
  isAdmin,
}: DuplicateCustomerDialogProps) {
  const isExactMatch = !!duplicateCustomer;
  const customer = duplicateCustomer || softMatches[0];

  if (!customer) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-lg">
              {isExactMatch ? 'Duplicate Customer Found' : 'Possible Duplicate'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-3 text-left">
            {isExactMatch ? (
              <span>
                A customer with this {duplicateCustomer.email_normalized ? 'email' : 'phone number'} already exists:
              </span>
            ) : (
              <span>
                A customer with a similar name and location was found:
              </span>
            )}
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="font-medium text-slate-900">
                {customer.display_name || `${customer.first_name} ${customer.last_name}`}
              </p>
              {customer.email && (
                <p className="text-sm text-slate-600">{customer.email}</p>
              )}
              {customer.phone && (
                <p className="text-sm text-slate-600">{customer.phone}</p>
              )}
              {(customer.city || customer.state) && (
                <p className="text-sm text-slate-500">
                  {[customer.city, customer.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onUseExisting(customer)}
            className="bg-primary hover:bg-primary/90"
          >
            Use Existing Customer
          </AlertDialogAction>
          {isAdmin && (
            <Button
              onClick={onCreateAnyway}
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
            >
              Create Anyway
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
