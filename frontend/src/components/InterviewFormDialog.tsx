import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/select-field';
import { useToast } from '@/hooks/use-toast';
import { Interview, InterviewType, JobApplication } from '@/types/tracker';

interface InterviewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Interview | null;
  prefillApplication?: JobApplication | null;
  applications: JobApplication[];
  onSave: (data: Partial<Interview>, editingId?: string) => Promise<{ ok: boolean; error?: string }>;
}

export const InterviewFormDialog: React.FC<InterviewFormDialogProps> = ({
  open,
  onOpenChange,
  editing,
  prefillApplication,
  applications,
  onSave,
}) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    applicationId: '',
    company: '',
    position: '',
    date: '',
    time: '10:00',
    type: 'Video Call' as InterviewType,
    location: '',
    meetingLink: '',
    notes: '',
    interviewer: '',
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setFormData({
        applicationId: editing.applicationId || '',
        company: editing.company,
        position: editing.position,
        date: editing.date,
        time: editing.time,
        type: editing.type,
        location: editing.location || '',
        meetingLink: editing.meetingLink || '',
        notes: editing.notes || '',
        interviewer: editing.interviewer || '',
      });
    } else if (prefillApplication) {
      setFormData({
        applicationId: prefillApplication.id,
        company: prefillApplication.company,
        position: prefillApplication.position,
        date: '',
        time: '10:00',
        type: 'Video Call',
        location: prefillApplication.location || '',
        meetingLink: '',
        notes: '',
        interviewer: '',
      });
    } else {
      setFormData({
        applicationId: '',
        company: '',
        position: '',
        date: '',
        time: '10:00',
        type: 'Video Call',
        location: '',
        meetingLink: '',
        notes: '',
        interviewer: '',
      });
    }
  }, [open, editing, prefillApplication]);

  const handleLinkApp = (appId: string) => {
    const match = applications.find((a) => a.id === appId);
    if (match) {
      setFormData((p) => ({
        ...p,
        applicationId: match.id,
        company: match.company,
        position: match.position,
        location: match.location || p.location,
      }));
    } else {
      setFormData((p) => ({ ...p, applicationId: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company.trim() || !formData.position.trim() || !formData.date || !formData.time) {
      toast({
        title: 'Missing fields',
        description: 'Company, role, date, and time are required',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSave(
        editing ? formData : { ...formData, status: 'Scheduled' },
        editing?.id
      );
      if (res.ok) {
        onOpenChange(false);
      } else if (res.error) {
        toast({ title: 'Could not save', description: res.error, variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 sm:p-0 overflow-hidden gap-0 bg-[hsl(var(--surface-card))] border-[var(--hairline-strong)] rounded-[14px]">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 pr-12 border-b border-[var(--hairline)] flex-shrink-0">
          <DialogTitle className="text-[18px] font-medium text-[hsl(var(--ink-primary))]">
            {editing ? 'Edit interview' : 'Schedule interview'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-3.5">
            {applications.length > 0 && !editing && (
              <div>
                <Label htmlFor="ivd-app" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Link tracked application
                </Label>
                <div className="mt-1.5">
                  <SelectField
                    id="ivd-app"
                    value={formData.applicationId}
                    onValueChange={handleLinkApp}
                    className="w-full"
                    options={[
                      { value: '', label: 'Enter manually' },
                      ...applications.map((a) => ({
                        value: a.id,
                        label: `${a.company} — ${a.position}`,
                      })),
                    ]}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ivd-company" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Company *
                </Label>
                <Input
                  id="ivd-company"
                  value={formData.company}
                  onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))}
                  placeholder="Stripe"
                  required
                  className="mt-1.5 h-9 rounded-[8px]"
                />
              </div>
              <div>
                <Label htmlFor="ivd-position" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Role *
                </Label>
                <Input
                  id="ivd-position"
                  value={formData.position}
                  onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))}
                  placeholder="Software Engineer"
                  required
                  className="mt-1.5 h-9 rounded-[8px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ivd-date" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Date *
                </Label>
                <Input
                  id="ivd-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                  required
                  className="mt-1.5 h-9 rounded-[8px] font-mono-num"
                />
              </div>
              <div>
                <Label htmlFor="ivd-time" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Time *
                </Label>
                <Input
                  id="ivd-time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData((p) => ({ ...p, time: e.target.value }))}
                  required
                  className="mt-1.5 h-9 rounded-[8px] font-mono-num"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ivd-type" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Format
                </Label>
                <div className="mt-1.5">
                  <SelectField
                    id="ivd-type"
                    value={formData.type}
                    onValueChange={(next) => setFormData((p) => ({ ...p, type: next as InterviewType }))}
                    className="w-full"
                    options={[
                      { value: 'Video Call', label: 'Video Call' },
                      { value: 'Phone Call', label: 'Phone Call' },
                      { value: 'On-site', label: 'On-site' },
                    ]}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="ivd-int" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Interviewer
                </Label>
                <Input
                  id="ivd-int"
                  value={formData.interviewer}
                  onChange={(e) => setFormData((p) => ({ ...p, interviewer: e.target.value }))}
                  placeholder="Name or hiring panel"
                  className="mt-1.5 h-9 rounded-[8px]"
                />
              </div>
            </div>

            {formData.type === 'Video Call' && (
              <div>
                <Label htmlFor="ivd-link" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Meeting link
                </Label>
                <Input
                  id="ivd-link"
                  type="url"
                  value={formData.meetingLink}
                  onChange={(e) => setFormData((p) => ({ ...p, meetingLink: e.target.value }))}
                  placeholder="https://meet.google.com/..."
                  className="mt-1.5 h-9 rounded-[8px]"
                />
              </div>
            )}

            {formData.type === 'On-site' && (
              <div>
                <Label htmlFor="ivd-loc" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Address
                </Label>
                <Input
                  id="ivd-loc"
                  value={formData.location}
                  onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Office address"
                  className="mt-1.5 h-9 rounded-[8px]"
                />
              </div>
            )}

            <div>
              <Label htmlFor="ivd-notes" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Preparation notes
              </Label>
              <textarea
                id="ivd-notes"
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Topics to cover or questions to ask"
                className="mt-1.5 w-full px-3 py-2 text-[13px] border border-[var(--hairline-strong)] rounded-[8px] bg-[hsl(var(--surface-card))] resize-none"
              />
            </div>
          </div>

          <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--hairline)] bg-[hsl(var(--surface-page))] flex justify-end gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-[8px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))]"
            >
              {submitting ? 'Saving...' : editing ? 'Save changes' : 'Schedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
