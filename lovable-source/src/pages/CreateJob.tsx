import { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers';
import { useWatches, useCreateWatch } from '@/hooks/useWatches';
import { useCreateJob, useNextJobId, useCheckJobIdExists } from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Watch, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
import { CustomerFormData, WatchFormData, JobFormData, JobStatus, PriorityLevel } from '@/types/database';
import { WATCH_BRANDS, JOB_STATUS_ORDER, JOB_STATUS_LABELS, PRIORITY_LABELS, validateJobId, normalizeJobIdInput } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

export default function CreateJob() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  
  // Fetch data
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: nextJobId, isLoading: nextJobIdLoading } = useNextJobId();
  
  // Mutations
  const createCustomer = useCreateCustomer();
  const createWatch = useCreateWatch();
  const createJob = useCreateJob();
  const checkJobIdExists = useCheckJobIdExists();
  
  // Step tracking
  const [step, setStep] = useState<'customer' | 'watch' | 'job'>('customer');
  
  // Customer state
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerForm, setCustomerForm] = useState<CustomerFormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
  });
  
  // Watch state
  const [watchForm, setWatchForm] = useState<WatchFormData>({
    brand: '',
    model: '',
    reference_number: '',
    serial_number: '',
  });
  
  // Job state
  const [jobForm, setJobForm] = useState<JobFormData>({
    job_id: '',
    status: 'intake',
    priority: 'normal',
    due_date: '',
    intake_notes: '',
  });
  
  // Job ID validation state
  const [jobIdError, setJobIdError] = useState<string>('');
  const [jobIdValid, setJobIdValid] = useState<boolean>(false);
  const [checkingJobId, setCheckingJobId] = useState(false);
  
  // Set suggested job ID when loaded
  useEffect(() => {
    if (nextJobId && !jobForm.job_id) {
      setJobForm(prev => ({ ...prev, job_id: nextJobId }));
    }
  }, [nextJobId]);
  
  // Validate job ID on change
  useEffect(() => {
    const validateId = async () => {
      const id = jobForm.job_id.trim();
      if (!id) {
        setJobIdError('');
        setJobIdValid(false);
        return;
      }
      
      const normalized = normalizeJobIdInput(id);
      if (!validateJobId(normalized)) {
        setJobIdError('Job ID must be in format E followed by digits (e.g., E1234)');
        setJobIdValid(false);
        return;
      }
      
      // Update form with normalized value
      if (normalized !== jobForm.job_id) {
        setJobForm(prev => ({ ...prev, job_id: normalized }));
      }
      
      setCheckingJobId(true);
      try {
        const exists = await checkJobIdExists.mutateAsync(normalized);
        if (exists) {
          setJobIdError(`Job ID ${normalized} already exists. Please choose a different ID.`);
          setJobIdValid(false);
        } else {
          setJobIdError('');
          setJobIdValid(true);
        }
      } catch {
        setJobIdError('Error checking Job ID');
        setJobIdValid(false);
      }
      setCheckingJobId(false);
    };
    
    const debounce = setTimeout(validateId, 300);
    return () => clearTimeout(debounce);
  }, [jobForm.job_id]);
  
  // Watches for selected customer
  const { data: customerWatches } = useWatches(selectedCustomerId || undefined);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCustomerId, setCreatedCustomerId] = useState<string>('');
  const [createdWatchId, setCreatedWatchId] = useState<string>('');

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  if (!user) return <Navigate to="/auth" replace />;

  const handleCustomerSubmit = async () => {
    if (customerMode === 'existing') {
      if (!selectedCustomerId) {
        toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' });
        return;
      }
      setCreatedCustomerId(selectedCustomerId);
      setStep('watch');
    } else {
      if (!customerForm.first_name || !customerForm.last_name) {
        toast({ title: 'Error', description: 'First and last name are required', variant: 'destructive' });
        return;
      }
      setIsSubmitting(true);
      try {
        const result = await createCustomer.mutateAsync(customerForm);
        setCreatedCustomerId(result.id);
        setStep('watch');
      } catch (err) {
        // Error handled by hook
      }
      setIsSubmitting(false);
    }
  };

  const handleWatchSubmit = async () => {
    if (!watchForm.brand) {
      toast({ title: 'Error', description: 'Watch brand is required', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createWatch.mutateAsync({
        customerId: createdCustomerId,
        watchData: watchForm,
      });
      setCreatedWatchId(result.id);
      setStep('job');
    } catch (err) {
      // Error handled by hook
    }
    setIsSubmitting(false);
  };

  const handleJobSubmit = async () => {
    if (!jobIdValid) {
      toast({ title: 'Error', description: 'Please enter a valid, unique Job ID', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createJob.mutateAsync({
        customerId: createdCustomerId,
        watchId: createdWatchId,
        jobData: jobForm,
      });
      navigate(`/jobs/${result.id}`);
    } catch (err) {
      // Error handled by hook
    }
    setIsSubmitting(false);
  };

  const useSuggestedJobId = () => {
    if (nextJobId) {
      setJobForm(prev => ({ ...prev, job_id: nextJobId }));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex items-center gap-3">
            <Watch className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-serif font-semibold">Create New Job</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'customer' ? 'bg-accent text-accent-foreground' : createdCustomerId ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'}`}>1</div>
            <span className="text-sm">Customer</span>
          </div>
          <div className="w-12 h-px bg-border mx-2" />
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'watch' ? 'bg-accent text-accent-foreground' : createdWatchId ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'}`}>2</div>
            <span className="text-sm">Watch</span>
          </div>
          <div className="w-12 h-px bg-border mx-2" />
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'job' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>3</div>
            <span className="text-sm">Job Details</span>
          </div>
        </div>

        {/* Step 1: Customer */}
        {step === 'customer' && (
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
              <CardDescription>Select an existing customer or create a new one</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={customerMode} onValueChange={(v) => setCustomerMode(v as 'existing' | 'new')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="existing">Existing Customer</TabsTrigger>
                  <TabsTrigger value="new">New Customer</TabsTrigger>
                </TabsList>
                
                <TabsContent value="existing">
                  {customersLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : (
                    <div className="space-y-4">
                      <Label>Select Customer</Label>
                      <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a customer..." />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.first_name} {c.last_name} {c.email && `(${c.email})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="new">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input id="first_name" value={customerForm.first_name} onChange={(e) => setCustomerForm(p => ({ ...p, first_name: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input id="last_name" value={customerForm.last_name} onChange={(e) => setCustomerForm(p => ({ ...p, last_name: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={customerForm.email} onChange={(e) => setCustomerForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={customerForm.phone} onChange={(e) => setCustomerForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end mt-6">
                <Button onClick={handleCustomerSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Watch */}
        {step === 'watch' && (
          <Card>
            <CardHeader>
              <CardTitle>Watch Details</CardTitle>
              <CardDescription>Enter the watch information for this service</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand *</Label>
                  <Select value={watchForm.brand} onValueChange={(v) => setWatchForm(p => ({ ...p, brand: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand..." />
                    </SelectTrigger>
                    <SelectContent>
                      {WATCH_BRANDS.map((brand) => (
                        <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" value={watchForm.model} onChange={(e) => setWatchForm(p => ({ ...p, model: e.target.value }))} placeholder="e.g., Submariner" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reference">Part #</Label>
                    <Input id="reference" value={watchForm.reference_number} onChange={(e) => setWatchForm(p => ({ ...p, reference_number: e.target.value }))} placeholder="e.g., 116610LN" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial">Serial Number</Label>
                  <Input id="serial" value={watchForm.serial_number} onChange={(e) => setWatchForm(p => ({ ...p, serial_number: e.target.value }))} placeholder="Watch serial number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="watch_notes">Notes</Label>
                  <Textarea id="watch_notes" value={watchForm.notes} onChange={(e) => setWatchForm(p => ({ ...p, notes: e.target.value }))} placeholder="Condition notes, visible damage, etc." />
                </div>
              </div>
              
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep('customer')}>Back</Button>
                <Button onClick={handleWatchSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Job Details */}
        {step === 'job' && (
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
              <CardDescription>Set the job ID, status, and priority</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Job ID with suggestion */}
                <div className="space-y-2">
                  <Label htmlFor="job_id">Job ID *</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input 
                        id="job_id" 
                        value={jobForm.job_id} 
                        onChange={(e) => setJobForm(p => ({ ...p, job_id: e.target.value.toUpperCase() }))}
                        placeholder="E1234"
                        className={jobIdError ? 'border-destructive' : jobIdValid ? 'border-success' : ''}
                      />
                      {checkingJobId && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {!checkingJobId && jobIdValid && (
                        <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                      )}
                    </div>
                    {nextJobId && (
                      <Button type="button" variant="outline" size="sm" onClick={useSuggestedJobId} className="flex items-center gap-1">
                        <Lightbulb className="h-4 w-4" />
                        Use {nextJobId}
                      </Button>
                    )}
                  </div>
                  {jobIdError && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{jobIdError}</AlertDescription>
                    </Alert>
                  )}
                  <p className="text-xs text-muted-foreground">Format: E followed by digits (e.g., E1234). You can also enter just digits.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={jobForm.status} onValueChange={(v) => setJobForm(p => ({ ...p, status: v as JobStatus }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_STATUS_ORDER.map((status) => (
                          <SelectItem key={status} value={status}>{JOB_STATUS_LABELS[status]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={jobForm.priority} onValueChange={(v) => setJobForm(p => ({ ...p, priority: v as PriorityLevel }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" type="date" value={jobForm.due_date} onChange={(e) => setJobForm(p => ({ ...p, due_date: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="intake_notes">Intake Notes</Label>
                  <Textarea id="intake_notes" value={jobForm.intake_notes} onChange={(e) => setJobForm(p => ({ ...p, intake_notes: e.target.value }))} placeholder="Service requested, customer instructions, etc." rows={4} />
                </div>
              </div>
              
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep('watch')}>Back</Button>
                <Button onClick={handleJobSubmit} disabled={isSubmitting || !jobIdValid}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Job
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
