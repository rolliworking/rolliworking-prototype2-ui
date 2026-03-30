import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EulaPage = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">End-User License Agreement (EULA)</CardTitle>
            <p className="text-muted-foreground">Last updated: January 12, 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using Rolliparts ("the Application"), you agree to be bound by this 
                End-User License Agreement. If you do not agree to these terms, do not use the Application.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">2. License Grant</h2>
              <p className="text-muted-foreground">
                Subject to your compliance with this Agreement, we grant you a limited, non-exclusive, 
                non-transferable, revocable license to access and use the Application for your internal 
                business purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">3. Restrictions</h2>
              <p className="text-muted-foreground">You agree not to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Copy, modify, or distribute the Application</li>
                <li>Reverse engineer, decompile, or disassemble the Application</li>
                <li>Use the Application for any unlawful purpose</li>
                <li>Share your account credentials with unauthorized parties</li>
                <li>Attempt to gain unauthorized access to the Application or its systems</li>
                <li>Use the Application to transmit malware, viruses, or harmful code</li>
                <li>Interfere with or disrupt the integrity or performance of the Application</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">4. Third-Party Integrations</h2>
              <p className="text-muted-foreground">
                The Application integrates with third-party services including QuickBooks Online ("QBO") 
                provided by Intuit Inc. Your use of such integrations is subject to the respective 
                third-party terms of service, including the Intuit Developer Terms of Service and 
                QuickBooks Online Terms of Service.
              </p>
              <p className="text-muted-foreground mt-2">
                By connecting your QuickBooks Online account, you authorize us to access and retrieve 
                data from your QBO account as necessary to provide the Application's services. We are 
                not responsible for third-party services, their availability, or any changes they may 
                make to their APIs or services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">5. Data and Security</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account and for all 
                activities that occur under your account. You agree to notify us immediately of any 
                unauthorized use of your account. You retain all ownership rights to your data. We 
                process your data solely to provide the Application's services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">6. Intellectual Property</h2>
              <p className="text-muted-foreground">
                The Application and its original content, features, and functionality are owned by 
                Rolliworks and are protected by international copyright, trademark, patent, trade 
                secret, and other intellectual property laws. You may not use our trademarks without 
                prior written consent.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">7. Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to defend, indemnify, and hold harmless Rolliworks, its affiliates, officers, 
                directors, employees, and agents from and against any claims, liabilities, damages, 
                losses, and expenses, including reasonable attorney's fees, arising out of or in any 
                way connected with:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Your access to or use of the Application</li>
                <li>Your violation of this Agreement</li>
                <li>Your violation of any third-party rights, including intellectual property rights</li>
                <li>Any data you submit or transmit through the Application</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">8. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground">
                THE APPLICATION IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND. 
                WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO 
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY 
                WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.
              </p>
              <p className="text-muted-foreground mt-2">
                WE DO NOT WARRANT THAT THE APPLICATION WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, 
                THAT DEFECTS WILL BE CORRECTED, OR THAT THE APPLICATION IS FREE OF VIRUSES OR OTHER 
                HARMFUL COMPONENTS.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">9. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL ROLLIWORKS, ITS AFFILIATES, 
                OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF 
                PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED 
                TO YOUR USE OF THE APPLICATION.
              </p>
              <p className="text-muted-foreground mt-2">
                OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US, IF ANY, IN THE TWELVE 
                (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">10. Termination</h2>
              <p className="text-muted-foreground">
                We may terminate or suspend your access to the Application at any time, with or without 
                cause, with or without notice. Upon termination, your right to use the Application will 
                immediately cease. All provisions of this Agreement which by their nature should survive 
                termination shall survive, including ownership provisions, warranty disclaimers, 
                indemnity, and limitations of liability.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">11. Governing Law and Jurisdiction</h2>
              <p className="text-muted-foreground">
                This Agreement shall be governed by and construed in accordance with the laws of the 
                State of California, United States, without regard to its conflict of law provisions. 
                Any disputes arising under or in connection with this Agreement shall be subject to 
                the exclusive jurisdiction of the state and federal courts located in Los Angeles County, 
                California. You waive any objections to such venue.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">12. Dispute Resolution</h2>
              <p className="text-muted-foreground">
                Any dispute arising from this Agreement shall first be attempted to be resolved through 
                good-faith negotiation. If negotiation fails, the parties agree to submit to binding 
                arbitration under the rules of the American Arbitration Association. You agree to 
                resolve disputes on an individual basis and waive any right to participate in class 
                actions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">13. Modifications</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify this Agreement at any time. We will notify you of any 
                material changes by posting the updated Agreement and updating the "Last updated" date. 
                Your continued use of the Application after such modifications constitutes acceptance 
                of the updated Agreement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">14. Severability</h2>
              <p className="text-muted-foreground">
                If any provision of this Agreement is found to be unenforceable or invalid, that 
                provision shall be limited or eliminated to the minimum extent necessary so that 
                this Agreement shall otherwise remain in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">15. Contact Information</h2>
              <p className="text-muted-foreground">
                For questions about this EULA, please contact us at:
              </p>
              <p className="text-muted-foreground mt-2">
                Rolliworks<br />
                Email: support@rolliworks.com<br />
                United States
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EulaPage;
