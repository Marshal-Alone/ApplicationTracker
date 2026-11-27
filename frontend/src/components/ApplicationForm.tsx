import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/select-field';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { APPLICATION_STATUSES, extractRequirementsList } from '@/lib/formatters';
import { ApplicationStatus, JobApplication } from '@/types/tracker';

interface ApplicationFormProps {
  application?: JobApplication | null;
  onClose: () => void;
  onSubmit: (data: Partial<JobApplication>) => Promise<void>;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  application,
  onClose,
  onSubmit,
}) => {
  const isEditing = !!application;

  const [formData, setFormData] = useState({
    company: application?.company || '',
    position: application?.position || '',
    location: application?.location || '',
    salary: application?.salary || '',
    jobUrl: application?.jobUrl || '',
    applyUrl: application?.applyUrl || '',
    description: application?.description || '',
    status: (application?.status || 'Applied') as ApplicationStatus,
    appliedDate: application?.appliedDate || new Date().toISOString().split('T')[0],
    resumeVersion: application?.resumeVersion || '',
    referralContact: application?.referralContact || '',
    followUpDate: application?.followUpDate || '',
    notes: application?.notes || '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const detectedRequirements = extractRequirementsList(
    formData.description,
    isEditing && formData.description.trim() === (application?.description || '').trim()
      ? application?.requirements
      : undefined
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company.trim() || !formData.position.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const {
        company,
        position,
        location,
        salary,
        jobUrl,
        applyUrl,
        description,
        status,
        appliedDate,
        resumeVersion,
        referralContact,
        followUpDate,
        notes,
      } = formData;
      await onSubmit({
        company,
        position,
        location,
        salary,
        jobUrl,
        applyUrl,
        description,
        requirements: detectedRequirements,
        status,
        appliedDate,
        resumeVersion,
        referralContact,
        followUpDate,
        notes,
      });
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 sm:p-0 overflow-hidden gap-0 bg-[hsl(var(--surface-card))] border-[var(--hairline-strong)] rounded-[14px]">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 pr-12 border-b border-[var(--hairline)] flex-shrink-0">
          <DialogTitle className="text-[18px] font-medium text-[hsl(var(--ink-primary))]">
            {isEditing ? 'Edit application' : 'Add application'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="app-company" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Company *
              </Label>
              <Input
                id="app-company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                required
                placeholder="Linear"
                className="mt-1.5 h-9 rounded-[8px]"
              />
            </div>
            <div>
              <Label htmlFor="app-position" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Position *
              </Label>
              <Input
                id="app-position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                required
                placeholder="Product Engineer"
                className="mt-1.5 h-9 rounded-[8px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="app-location" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Location
              </Label>
              <Input
                id="app-location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Bengaluru or Remote"
                className="mt-1.5 h-9 rounded-[8px]"
              />
            </div>
            <div>
              <Label htmlFor="app-salary" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Compensation
              </Label>
              <Input
                id="app-salary"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                placeholder="₹24,00,000 or $140,000"
                className="mt-1.5 h-9 rounded-[8px] font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="app-jobUrl" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Job posting URL
              </Label>
              <Input
                id="app-jobUrl"
                name="jobUrl"
                type="url"
                value={formData.jobUrl}
                onChange={handleChange}
                placeholder="https://linkedin.com/jobs/view/..."
                className="mt-1.5 h-9 rounded-[8px]"
              />
            </div>
            <div>
              <Label htmlFor="app-applyUrl" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                External apply URL
              </Label>
              <Input
                id="app-applyUrl"
                name="applyUrl"
                type="url"
                value={formData.applyUrl}
                onChange={handleChange}
                placeholder="https://boards.greenhouse.io/..."
                className="mt-1.5 h-9 rounded-[8px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="app-status" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Stage
              </Label>
              <div className="mt-1.5">
                <SelectField
                  id="app-status"
                  value={formData.status}
                  onValueChange={(next) =>
                    setFormData((prev) => ({ ...prev, status: next as ApplicationStatus }))
                  }
                  className="w-full"
                  options={APPLICATION_STATUSES.map((st) => ({ value: st, label: st }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="app-appliedDate" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Applied date
              </Label>
              <Input
                id="app-appliedDate"
                name="appliedDate"
                type="date"
                value={formData.appliedDate}
                onChange={handleChange}
                className="mt-1.5 h-9 rounded-[8px] font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="app-resume" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Resume version
              </Label>
              <Input
                id="app-resume"
                name="resumeVersion"
                value={formData.resumeVersion}
                onChange={handleChange}
                placeholder="Resume_SDE_v1.pdf"
                className="mt-1.5 h-9 rounded-[8px]"
              />
            </div>
            <div>
              <Label htmlFor="app-referral" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Referral / contact
              </Label>
              <Input
                id="app-referral"
                name="referralContact"
                value={formData.referralContact}
                onChange={handleChange}
                placeholder="Alumni or recruiter name"
                className="mt-1.5 h-9 rounded-[8px]"
              />
            </div>
            <div>
              <Label htmlFor="app-followup" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Follow-up date
              </Label>
              <Input
                id="app-followup"
                name="followUpDate"
                type="date"
                value={formData.followUpDate}
                onChange={handleChange}
                className="mt-1.5 h-9 rounded-[8px] font-mono-num"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="app-description" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Job description
              </Label>
              <span className="text-[11px] font-mono-num text-[hsl(var(--ink-muted))]">
                {detectedRequirements.length > 0
                  ? `${detectedRequirements.length} requirement${detectedRequirements.length === 1 ? '' : 's'} detected`
                  : 'Paste "Who You Are" or Requirements to extract bullets'}
              </span>
            </div>
            <textarea
              id="app-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={5}
              className="mt-1.5 w-full px-3 py-2 text-[13px] border border-[var(--hairline-strong)] rounded-[8px] bg-[hsl(var(--surface-card))] resize-y"
              placeholder="Role summary, Who You Are, or key qualifications"
            />
          </div>

          <div>
            <Label htmlFor="app-notes" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
              Personal notes
            </Label>
            <textarea
              id="app-notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="mt-1.5 w-full px-3 py-2 text-[13px] border border-[var(--hairline-strong)] rounded-[8px] bg-[hsl(var(--surface-card))] resize-none"
              placeholder="Referral contact, salary range discussed, follow-up date"
            />
          </div>
          </div>

          <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--hairline)] bg-[hsl(var(--surface-page))] flex justify-end gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 px-4 rounded-[8px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.company.trim() || !formData.position.trim()}
              className="h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))]"
            >
              {isLoading ? 'Saving...' : isEditing ? 'Save changes' : 'Add application'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
