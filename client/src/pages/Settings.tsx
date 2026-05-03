import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Database,
  Calendar,
  Save,
  RefreshCw,
} from 'lucide-react';

interface SystemSettings {
  academicYear: string;
  submissionDeadline: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  autoLockDays: number;
  emailNotifications: boolean;
  reminderDays: number;
  maintenanceMode: boolean;
  backupFrequency: string;
  sessionTimeout: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  academicYear: '2024-25',
  submissionDeadline: '2025-03-31',
  maxFileSize: 10,
  allowedFileTypes: ['pdf', 'jpg', 'png', 'doc', 'docx'],
  autoLockDays: 30,
  emailNotifications: true,
  reminderDays: 7,
  maintenanceMode: false,
  backupFrequency: 'daily',
  sessionTimeout: 60,
};

export default function Settings() {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const stored = localStorage.getItem('fpms_settings');
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));
    localStorage.setItem('fpms_settings', JSON.stringify(settings));
    setIsSaving(false);
    toast({ title: 'Settings Saved', description: 'Your changes have been saved successfully.' });
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('fpms_settings', JSON.stringify(DEFAULT_SETTINGS));
    toast({ title: 'Settings Reset', description: 'All settings have been reset to default.' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">System Settings</h1>
            <p className="text-muted-foreground">Configure FPMS system parameters and preferences</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Academic Year Settings
                  </CardTitle>
                  <CardDescription>Configure academic year and submission deadlines</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="academicYear">Current Academic Year</Label>
                    <Select
                      value={settings.academicYear}
                      onValueChange={(value) => setSettings({ ...settings, academicYear: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2023-24">2023-24</SelectItem>
                        <SelectItem value="2024-25">2024-25</SelectItem>
                        <SelectItem value="2025-26">2025-26</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Submission Deadline</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={settings.submissionDeadline}
                      onChange={(e) =>
                        setSettings({ ...settings, submissionDeadline: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="autoLock">Auto-Lock After Approval (Days)</Label>
                    <Input
                      id="autoLock"
                      type="number"
                      value={settings.autoLockDays}
                      onChange={(e) =>
                        setSettings({ ...settings, autoLockDays: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Submissions will be automatically locked after this many days post-approval
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card">
                <CardHeader>
                  <CardTitle>File Upload Settings</CardTitle>
                  <CardDescription>Configure evidence upload parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxFileSize">Maximum File Size (MB)</Label>
                    <Input
                      id="maxFileSize"
                      type="number"
                      value={settings.maxFileSize}
                      onChange={(e) =>
                        setSettings({ ...settings, maxFileSize: parseInt(e.target.value) || 1 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Allowed File Types</Label>
                    <div className="flex flex-wrap gap-2">
                      {['pdf', 'jpg', 'png', 'doc', 'docx', 'xls', 'xlsx'].map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={settings.allowedFileTypes.includes(type)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSettings({
                                  ...settings,
                                  allowedFileTypes: [...settings.allowedFileTypes, type],
                                });
                              } else {
                                setSettings({
                                  ...settings,
                                  allowedFileTypes: settings.allowedFileTypes.filter((t) => t !== type),
                                });
                              }
                            }}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span className="text-sm uppercase">.{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Configure email and system notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for submission updates
                    </p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, emailNotifications: checked })
                    }
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="reminderDays">Deadline Reminder (Days Before)</Label>
                  <Input
                    id="reminderDays"
                    type="number"
                    value={settings.reminderDays}
                    onChange={(e) =>
                      setSettings({ ...settings, reminderDays: parseInt(e.target.value) || 0 })
                    }
                    disabled={!settings.emailNotifications}
                  />
                  <p className="text-xs text-muted-foreground">
                    Send reminder emails this many days before the deadline
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Security Settings
                </CardTitle>
                <CardDescription>Configure security and access parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (Minutes)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) =>
                      setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Users will be logged out after this period of inactivity
                  </p>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">Password Policy</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm font-medium text-foreground">Minimum Length</p>
                      <p className="text-2xl font-bold text-primary">8 characters</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm font-medium text-foreground">Complexity Required</p>
                      <p className="text-sm text-muted-foreground">
                        Uppercase, lowercase, number, special character
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings */}
          <TabsContent value="system">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Database & Backup
                  </CardTitle>
                  <CardDescription>Configure backup and data management</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Backup Frequency</Label>
                    <Select
                      value={settings.backupFrequency}
                      onValueChange={(value) => setSettings({ ...settings, backupFrequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg border border-border p-4 bg-muted/30">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-foreground">Last Backup</p>
                        <p className="text-xs text-muted-foreground">December 28, 2025 at 02:00 AM</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Backup Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card">
                <CardHeader>
                  <CardTitle>Maintenance Mode</CardTitle>
                  <CardDescription>Enable maintenance mode during system updates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Maintenance Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Disable user access during maintenance
                      </p>
                    </div>
                    <Switch
                      checked={settings.maintenanceMode}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, maintenanceMode: checked })
                      }
                    />
                  </div>
                  {settings.maintenanceMode && (
                    <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
                      <p className="text-sm text-warning font-medium">
                        Warning: Maintenance mode is enabled. Users cannot access the system.
                      </p>
                    </div>
                  )}
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">System Information</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Version</span>
                        <span className="text-foreground font-medium">1.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Environment</span>
                        <span className="text-foreground font-medium">Production</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Storage Used</span>
                        <span className="text-foreground font-medium">2.4 GB / 10 GB</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
