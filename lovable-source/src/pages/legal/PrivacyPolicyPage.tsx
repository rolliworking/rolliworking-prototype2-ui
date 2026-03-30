import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: January 12, 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold">1. Introduction</h2>
              <p className="text-muted-foreground">
                Rolliworks ("we", "our", or "us") operates Rolliparts. This Privacy Policy explains 
                how we collect, use, disclose, and safeguard your information when you use our application.
                By using our Application, you consent to the data practices described in this policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">2. Information We Collect</h2>
              <p className="text-muted-foreground">We may collect the following types of information:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Personal Information:</strong> Name, email address, phone number, and business address</li>
                <li><strong>Account Information:</strong> Login credentials and account preferences</li>
                <li><strong>Business Data:</strong> Customer records, job information, inventory data, and financial records</li>
                <li><strong>Third-Party Data:</strong> Information from connected services like QuickBooks Online, including customer lists, invoices, and financial data</li>
                <li><strong>Usage Data:</strong> How you interact with our application, including pages visited, features used, and session duration</li>
                <li><strong>Device Information:</strong> Browser type, IP address, operating system, and device identifiers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
              <p className="text-muted-foreground">We use your information to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Provide, operate, and maintain the Application</li>
                <li>Improve and personalize your experience</li>
                <li>Process transactions and manage your account</li>
                <li>Sync data with connected third-party services</li>
                <li>Communicate with you about updates, support, and promotional offers</li>
                <li>Monitor and analyze usage patterns and trends</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">4. QuickBooks Online Data Handling</h2>
              <p className="text-muted-foreground">
                When you connect your QuickBooks Online account to our Application:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Data Accessed:</strong> We access customer information, company data, and related records necessary to provide our services</li>
                <li><strong>Purpose:</strong> We use this data solely to sync and display your QuickBooks information within our Application</li>
                <li><strong>Storage:</strong> QuickBooks data is stored securely in our database and is associated with your account</li>
                <li><strong>No Selling:</strong> We do not sell, rent, or share your QuickBooks data with third parties for their marketing purposes</li>
                <li><strong>Read-Only Access:</strong> Our current integration only reads data from QuickBooks; we do not modify your QuickBooks records</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">5. Data Disconnection and Deletion</h2>
              <p className="text-muted-foreground">
                You have the right to disconnect and delete your data at any time:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Disconnect QuickBooks:</strong> You can disconnect your QuickBooks Online account from within the Application settings or directly from your Intuit account at apps.com</li>
                <li><strong>Data Deletion:</strong> Upon disconnection, we will cease accessing your QuickBooks data. You may request complete deletion of previously synced data by contacting support@rolliworks.com</li>
                <li><strong>Retention Period:</strong> If you do not request deletion, synced data may be retained for up to 30 days after disconnection for service continuity, after which it will be automatically deleted</li>
                <li><strong>Account Deletion:</strong> To delete your entire account and all associated data, contact us at support@rolliworks.com</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">6. Third-Party Service Providers</h2>
              <p className="text-muted-foreground">
                We may share your information with the following categories of service providers:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Cloud Infrastructure:</strong> Supabase (database and authentication hosting)</li>
                <li><strong>Email Services:</strong> Resend (transactional emails)</li>
                <li><strong>Analytics:</strong> Usage analytics for improving our services</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                These providers are contractually obligated to protect your data and use it only for 
                the purposes we specify.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">7. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational security measures to protect your 
                information, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Encryption of data in transit using TLS/SSL</li>
                <li>Encryption of sensitive data at rest</li>
                <li>Secure authentication mechanisms including password hashing</li>
                <li>Role-based access controls</li>
                <li>Regular security assessments and monitoring</li>
                <li>Secure API connections with OAuth 2.0 for third-party integrations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">8. Security Breach Notification</h2>
              <p className="text-muted-foreground">
                In the event of a data breach that affects your personal information:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>We will notify affected users via email within 72 hours of discovering the breach</li>
                <li>We will provide details about what information was affected</li>
                <li>We will describe the measures we are taking to address the breach</li>
                <li>We will provide guidance on steps you can take to protect yourself</li>
                <li>We will notify relevant regulatory authorities as required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">9. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your information for as long as your account is active or as needed to provide 
                services. Specifically:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Account Data:</strong> Retained while your account is active</li>
                <li><strong>Transaction Records:</strong> Retained for 7 years for tax and legal compliance</li>
                <li><strong>Usage Logs:</strong> Retained for 90 days</li>
                <li><strong>Synced Third-Party Data:</strong> Deleted within 30 days of disconnection unless you request immediate deletion</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">10. Your Rights</h2>
              <p className="text-muted-foreground">Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Access:</strong> Request a copy of your personal information</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your data ("right to be forgotten")</li>
                <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
                <li><strong>Objection:</strong> Object to certain data processing activities</li>
                <li><strong>Restriction:</strong> Request restriction of processing</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent for processing where consent is the legal basis</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                To exercise these rights, contact us at support@rolliworks.com. We will respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">11. California Privacy Rights (CCPA)</h2>
              <p className="text-muted-foreground">
                California residents have additional rights under the California Consumer Privacy Act:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Right to know what personal information is collected</li>
                <li>Right to know if personal information is sold or disclosed</li>
                <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
                <li>Right to non-discrimination for exercising privacy rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">12. International Data Transfers</h2>
              <p className="text-muted-foreground">
                Your information may be transferred to and processed in countries other than your own. 
                We ensure appropriate safeguards are in place, including standard contractual clauses 
                and compliance with applicable data protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">13. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our Application is not intended for individuals under the age of 18. We do not knowingly 
                collect personal information from children. If we become aware that we have collected 
                personal information from a child under 18, we will take steps to delete that information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">14. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any material 
                changes by:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Posting the new Privacy Policy on this page</li>
                <li>Updating the "Last updated" date</li>
                <li>Sending an email notification for significant changes</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                We encourage you to review this Privacy Policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">15. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this Privacy Policy or wish to exercise your data rights, 
                please contact us at:
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Rolliworks</strong><br />
                Email: support@rolliworks.com<br />
                United States
              </p>
              <p className="text-muted-foreground mt-2">
                For privacy-specific inquiries, you may also contact our Data Protection contact at 
                privacy@rolliworks.com.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
