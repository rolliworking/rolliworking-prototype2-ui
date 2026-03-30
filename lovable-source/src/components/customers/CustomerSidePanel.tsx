import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronRight, MapPin, Building2 } from 'lucide-react';
import { CustomerHistory } from './CustomerHistory';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useCreateCustomer,
  useUpdateCustomer,
  useCustomerAddresses,
  useCustomerCommunicationPermissions,
  useSaveCustomerAddresses,
  useSaveCustomerCommunicationPermissions,
  useCheckDuplicateCustomer,
  useOrganizations,
} from '@/hooks/useCustomers';
import { Customer } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { DuplicateCustomerDialog } from './DuplicateCustomerDialog';
import { useToast } from '@/hooks/use-toast';

const customerSchema = z.object({
  title: z.string().optional(),
  first_name: z.string().optional(),
  middle_name: z.string().optional(),
  last_name: z.string().optional(),
  suffix: z.string().optional(),
  company_name: z.string().optional(),
  display_name: z.string().min(1, 'Display name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile_phone: z.string().optional(),
  internal_notes: z.string().optional(),
  website: z.string().optional(),
  consent_email: z.string().optional(),
  consent_recorded: z.boolean().optional(),
  billing_street1: z.string().optional(),
  billing_street2: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_zip: z.string().optional(),
  billing_country: z.string().optional(),
  shipping_same_as_billing: z.boolean().optional(),
  shipping_street1: z.string().optional(),
  shipping_street2: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_state: z.string().optional(),
  shipping_zip: z.string().optional(),
  shipping_country: z.string().optional(),
  is_organization: z.boolean().optional(),
  parent_customer_id: z.string().optional().nullable(),
}).refine(
  (data) => {
    const hasNames = data.first_name && data.last_name;
    const hasDisplayName = data.display_name && data.display_name.trim().length > 0;
    return hasNames || hasDisplayName;
  },
  {
    message: 'Provide first and last name, or a display name',
    path: ['display_name'],
  }
);

type CustomerFormDataSchema = z.infer<typeof customerSchema>;

interface CustomerSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  onSave?: (customer: Customer) => void;
  initialSearchText?: string;
  showHistory?: boolean;
}

export function CustomerSidePanel({
  open,
  onOpenChange,
  customer,
  onSave,
  initialSearchText,
  showHistory = false,
}: CustomerSidePanelProps) {
  const { role } = useAuth();
  const { toast } = useToast();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const saveAddresses = useSaveCustomerAddresses();
  const saveCommunication = useSaveCustomerCommunicationPermissions();
  const checkDuplicate = useCheckDuplicateCustomer();
  const { data: organizations } = useOrganizations();

  const [nameContactOpen, setNameContactOpen] = useState(true);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [addressesOpen, setAddressesOpen] = useState(true);
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<CustomerFormDataSchema | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<{
    exactMatch: Customer | null;
    softMatches: Customer[];
  }>({ exactMatch: null, softMatches: [] });

  const isEditing = !!customer;
  const canEdit = role === 'admin' || role === 'manager';
  const canCreate = role === 'admin' || role === 'manager' || role === 'office';
  const isReadOnly = isEditing && !canEdit;
  const isAdmin = role === 'admin';

  // Fetch related data when editing
  const { data: addresses } = useCustomerAddresses(customer?.id || '');
  const { data: communicationPermissions } = useCustomerCommunicationPermissions(customer?.id || '');

  const form = useForm<CustomerFormDataSchema>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      title: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      suffix: '',
      company_name: '',
      display_name: '',
      email: '',
      phone: '',
      mobile_phone: '',
      internal_notes: '',
      website: '',
      consent_email: '',
      consent_recorded: false,
      billing_street1: '',
      billing_street2: '',
      billing_city: '',
      billing_state: '',
      billing_zip: '',
      billing_country: 'US',
      shipping_same_as_billing: true,
      shipping_street1: '',
      shipping_street2: '',
      shipping_city: '',
      shipping_state: '',
      shipping_zip: '',
      shipping_country: 'US',
      is_organization: false,
      parent_customer_id: null,
    },
  });

  const firstName = form.watch('first_name');
  const lastName = form.watch('last_name');
  const middleName = form.watch('middle_name');
  const shippingSameAsBilling = form.watch('shipping_same_as_billing');

  // Auto-generate display name when name changes
  useEffect(() => {
    if (!isEditing && (firstName || lastName)) {
      const parts = [firstName, middleName, lastName].filter(Boolean);
      form.setValue('display_name', parts.join(' '), { shouldValidate: false });
    }
  }, [firstName, middleName, lastName, form, isEditing]);

  // Reset form when customer changes or panel opens with initialSearchText
  useEffect(() => {
    if (customer) {
      const billingAddress = addresses?.find(a => a.address_type === 'billing');
      const shippingAddress = addresses?.find(a => a.address_type === 'shipping');

      form.reset({
        title: customer.title || '',
        first_name: customer.first_name || '',
        middle_name: customer.middle_name || '',
        last_name: customer.last_name || '',
        suffix: customer.suffix || '',
        company_name: customer.company_name || '',
        display_name: customer.display_name || `${customer.first_name} ${customer.last_name}`.trim(),
        email: customer.email || '',
        phone: customer.phone || '',
        mobile_phone: customer.mobile_phone || '',
        internal_notes: customer.internal_notes || '',
        website: customer.website || '',
        consent_email: communicationPermissions?.consent_email || '',
        consent_recorded: communicationPermissions?.consent_recorded || false,
        billing_street1: billingAddress?.street1 || customer.address || '',
        billing_street2: billingAddress?.street2 || '',
        billing_city: billingAddress?.city || customer.city || '',
        billing_state: billingAddress?.state || customer.state || '',
        billing_zip: billingAddress?.zip || customer.zip || '',
        billing_country: billingAddress?.country || 'US',
        shipping_same_as_billing: shippingAddress?.is_same_as_billing ?? true,
        shipping_street1: shippingAddress?.street1 || '',
        shipping_street2: shippingAddress?.street2 || '',
        shipping_city: shippingAddress?.city || '',
        shipping_state: shippingAddress?.state || '',
        shipping_zip: shippingAddress?.zip || '',
        shipping_country: shippingAddress?.country || 'US',
        is_organization: customer.is_organization ?? false,
        parent_customer_id: customer.parent_customer_id || null,
      });
    } else if (open && initialSearchText) {
      // Pre-fill display_name with search text for new customers
      // Try to parse first/last name from search text
      const nameParts = initialSearchText.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      form.reset({
        title: '',
        first_name: firstName,
        middle_name: '',
        last_name: lastName,
        suffix: '',
        company_name: '',
        display_name: initialSearchText.trim(),
        email: '',
        phone: '',
        mobile_phone: '',
        internal_notes: '',
        website: '',
        consent_email: '',
        consent_recorded: false,
        billing_street1: '',
        billing_street2: '',
        billing_city: '',
        billing_state: '',
        billing_zip: '',
        billing_country: 'US',
        shipping_same_as_billing: true,
        shipping_street1: '',
        shipping_street2: '',
        shipping_city: '',
        shipping_state: '',
        shipping_zip: '',
        shipping_country: 'US',
        is_organization: false,
        parent_customer_id: null,
      });
    } else if (open && !customer) {
      form.reset();
    }
  }, [customer, addresses, communicationPermissions, form, open, initialSearchText]);

  const saveCustomerData = async (data: CustomerFormDataSchema, skipDuplicateCheck = false) => {
    // Check for duplicates before saving (only for new customers)
    if (!isEditing && !skipDuplicateCheck) {
      const duplicateCheck = await checkDuplicate.mutateAsync({
        email: data.email,
        phone: data.phone,
        lastName: data.last_name,
        city: data.billing_city,
        state: data.billing_state,
      });

      if (duplicateCheck.isDuplicate || duplicateCheck.softMatches.length > 0) {
        setDuplicateResult({
          exactMatch: duplicateCheck.exactMatch,
          softMatches: duplicateCheck.softMatches,
        });
        setPendingFormData(data);
        setDuplicateDialogOpen(true);
        return;
      }
    }

    // Map form data to customer table columns
    const customerData = {
      title: data.title || null,
      first_name: data.first_name || data.display_name.split(' ')[0] || '',
      middle_name: data.middle_name || null,
      last_name: data.last_name || data.display_name.split(' ').slice(1).join(' ') || '',
      suffix: data.suffix || null,
      company_name: data.company_name || null,
      display_name: data.display_name,
      email: data.email || null,
      phone: data.phone || null,
      mobile_phone: data.mobile_phone || null,
      website: data.website || null,
      internal_notes: data.internal_notes || null,
      address: data.billing_street1 || null,
      city: data.billing_city || null,
      state: data.billing_state || null,
      zip: data.billing_zip || null,
      is_organization: data.is_organization ?? false,
      parent_customer_id: data.parent_customer_id || null,
    };

    try {
      let savedCustomer: Customer;

      if (isEditing && customer) {
        savedCustomer = await updateCustomer.mutateAsync({
          customerId: customer.id,
          data: customerData,
        });
      } else {
        savedCustomer = await createCustomer.mutateAsync(customerData);
      }

      // Save addresses
      await saveAddresses.mutateAsync({
        customerId: savedCustomer.id,
        billing: {
          street1: data.billing_street1,
          street2: data.billing_street2,
          city: data.billing_city,
          state: data.billing_state,
          zip: data.billing_zip,
          country: data.billing_country,
        },
        shipping: data.shipping_same_as_billing ? {
          street1: data.billing_street1,
          street2: data.billing_street2,
          city: data.billing_city,
          state: data.billing_state,
          zip: data.billing_zip,
          country: data.billing_country,
          is_same_as_billing: true,
        } : {
          street1: data.shipping_street1,
          street2: data.shipping_street2,
          city: data.shipping_city,
          state: data.shipping_state,
          zip: data.shipping_zip,
          country: data.shipping_country,
          is_same_as_billing: false,
        },
      });

      // Save communication permissions
      if (data.consent_email || data.consent_recorded) {
        await saveCommunication.mutateAsync({
          customerId: savedCustomer.id,
          consent_email: data.consent_email,
          consent_recorded: data.consent_recorded,
        });
      }

      onSave?.(savedCustomer);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutations
    }
  };

  const handleSubmit = async (data: CustomerFormDataSchema) => {
    await saveCustomerData(data);
  };

  const handleUseExistingCustomer = (existingCustomer: Customer) => {
    setDuplicateDialogOpen(false);
    setPendingFormData(null);
    onSave?.(existingCustomer);
    onOpenChange(false);
    toast({
      title: 'Customer Selected',
      description: `Using existing customer: ${existingCustomer.display_name || existingCustomer.first_name + ' ' + existingCustomer.last_name}`,
    });
  };

  const handleCreateAnyway = async () => {
    setDuplicateDialogOpen(false);
    if (pendingFormData) {
      await saveCustomerData(pendingFormData, true);
    }
    setPendingFormData(null);
  };

  const isSaving = createCustomer.isPending || updateCustomer.isPending || saveAddresses.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">
                {isEditing ? 'Customer Details' : 'New Customer'}
              </SheetTitle>
            </div>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
              {/* Section 1: Name and Contact */}
              <Collapsible open={nameContactOpen} onOpenChange={setNameContactOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-left hover:bg-muted rounded px-2">
                  {nameContactOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">Name and contact</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pt-3 space-y-4">
                  {/* Name row */}
                  <div className="grid grid-cols-6 gap-2">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Title</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Mr."
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-xs text-muted-foreground">First name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="First name"
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="middle_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Middle</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-xs text-muted-foreground">Last name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Last name"
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Suffix and Company */}
                  <div className="grid grid-cols-4 gap-2">
                    <FormField
                      control={form.control}
                      name="suffix"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Suffix</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Jr."
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company_name"
                      render={({ field }) => (
                        <FormItem className="col-span-3">
                          <FormLabel className="text-xs text-muted-foreground">Company</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Company name"
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Organization Settings */}
                  <Collapsible open={organizationOpen} onOpenChange={setOrganizationOpen}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-left hover:bg-muted rounded px-2">
                      {organizationOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Organization</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-2 pt-3 space-y-3">
                      <FormField
                        control={form.control}
                        name="is_organization"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isReadOnly}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">
                                This is an organization/company
                              </FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Mark this customer as a parent organization that can have sub-clients
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="parent_customer_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">
                              Parent organization
                            </FormLabel>
                            <Select
                              value={field.value || ''}
                              onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                              disabled={isReadOnly}
                            >
                              <FormControl>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Select parent organization..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">None (Independent customer)</SelectItem>
                                {organizations
                                  ?.filter(org => org.id !== customer?.id) // Prevent self-reference
                                  .map(org => (
                                    <SelectItem key={org.id} value={org.id}>
                                      {org.display_name || org.company_name || `${org.first_name} ${org.last_name}`}
                                    </SelectItem>
                                  ))
                                }
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Link this customer as a sub-client of an organization
                            </p>
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  <FormField
                    control={form.control}
                    name="display_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          Customer display name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="h-9 text-sm"
                            disabled={isReadOnly}
                            onChange={(e) => {
                              field.onChange(e);
                              // Auto-fill first/last name if they're empty
                              const value = e.target.value.trim();
                              const currentFirst = form.getValues('first_name');
                              const currentLast = form.getValues('last_name');
                              
                              // Only auto-fill if both first and last name are empty
                              if (!currentFirst && !currentLast && value) {
                                const nameParts = value.split(/\s+/);
                                if (nameParts.length >= 1) {
                                  form.setValue('first_name', nameParts[0], { shouldValidate: false });
                                }
                                if (nameParts.length >= 2) {
                                  form.setValue('last_name', nameParts.slice(1).join(' '), { shouldValidate: false });
                                }
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Contact fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="email@example.com"
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Phone</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="(555) 123-4567"
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="mobile_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Mobile</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="(555) 123-4567"
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Website</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="www.example.com"
                              className="h-9 text-sm"
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="internal_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Notes / Internal comments</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Internal notes about this customer..."
                            className="text-sm resize-none"
                            rows={3}
                            disabled={isReadOnly}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* Section 2: Addresses */}
              <Collapsible open={addressesOpen} onOpenChange={setAddressesOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-left hover:bg-muted rounded px-2 border-t border-border pt-4">
                  {addressesOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">Addresses</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pt-3 space-y-6">
                  {/* Billing Address */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Billing address</span>
                    </div>
                    <div className="space-y-3 pl-6">
                      <FormField
                        control={form.control}
                        name="billing_street1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Street</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="123 Main St"
                                className="h-9 text-sm"
                                disabled={isReadOnly}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="billing_street2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Street 2</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Suite 100"
                                className="h-9 text-sm"
                                disabled={isReadOnly}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-6 gap-2">
                        <FormField
                          control={form.control}
                          name="billing_city"
                          render={({ field }) => (
                            <FormItem className="col-span-3">
                              <FormLabel className="text-xs text-muted-foreground">City</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="City"
                                  className="h-9 text-sm"
                                  disabled={isReadOnly}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="billing_state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">State</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="CA"
                                  className="h-9 text-sm"
                                  disabled={isReadOnly}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="billing_zip"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel className="text-xs text-muted-foreground">ZIP</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="12345"
                                  className="h-9 text-sm"
                                  disabled={isReadOnly}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="billing_country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Country</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="US"
                                className="h-9 text-sm"
                                disabled={isReadOnly}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Shipping address</span>
                    </div>
                    <div className="pl-6 space-y-3">
                      <FormField
                        control={form.control}
                        name="shipping_same_as_billing"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isReadOnly}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">
                              Same as billing address
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      {!shippingSameAsBilling && (
                        <>
                          <FormField
                            control={form.control}
                            name="shipping_street1"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-muted-foreground">Street</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="123 Main St"
                                    className="h-9 text-sm"
                                    disabled={isReadOnly}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="shipping_street2"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-muted-foreground">Street 2</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Suite 100"
                                    className="h-9 text-sm"
                                    disabled={isReadOnly}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-6 gap-2">
                            <FormField
                              control={form.control}
                              name="shipping_city"
                              render={({ field }) => (
                                <FormItem className="col-span-3">
                                  <FormLabel className="text-xs text-muted-foreground">City</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="City"
                                      className="h-9 text-sm"
                                      disabled={isReadOnly}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="shipping_state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-muted-foreground">State</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="CA"
                                      className="h-9 text-sm"
                                      disabled={isReadOnly}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="shipping_zip"
                              render={({ field }) => (
                                <FormItem className="col-span-2">
                                  <FormLabel className="text-xs text-muted-foreground">ZIP</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="12345"
                                      className="h-9 text-sm"
                                      disabled={isReadOnly}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="shipping_country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-muted-foreground">Country</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="US"
                                    className="h-9 text-sm"
                                    disabled={isReadOnly}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Section 3: Communication Permissions */}
              <Collapsible open={communicationOpen} onOpenChange={setCommunicationOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-left hover:bg-muted rounded px-2 border-t border-border pt-4">
                  {communicationOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">Communication permissions</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pt-3 space-y-4">
                  <FormField
                    control={form.control}
                    name="consent_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Email used for consent</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="consent@example.com"
                            className="h-9 text-sm"
                            disabled={isReadOnly}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="consent_recorded"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isReadOnly}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal text-foreground">
                          Customer consent recorded
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is for internal tracking only. No automated marketing is sent.
                  </p>
                </CollapsibleContent>
              </Collapsible>

              {/* Section 4: Customer History (only when editing) */}
              {isEditing && customer?.id && (
                <CustomerHistory customerId={customer.id} defaultOpen={showHistory} />
              )}

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                {(!isEditing && canCreate) || (isEditing && canEdit) ? (
                  <Button
                    type="submit"
                    className="bg-[#2ca01c] hover:bg-[#238c16]"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Customer'}
                  </Button>
                ) : null}
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <DuplicateCustomerDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        duplicateCustomer={duplicateResult.exactMatch}
        softMatches={duplicateResult.softMatches}
        onUseExisting={handleUseExistingCustomer}
        onCreateAnyway={handleCreateAnyway}
        isAdmin={isAdmin}
      />
    </>
  );
}
